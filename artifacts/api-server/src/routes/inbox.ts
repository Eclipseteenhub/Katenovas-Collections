import { Router, type IRouter } from "express";
import { db, conversationsTable, conversationMessagesTable } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// GET /api/conversations — list all (admin)
router.get("/conversations", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.lastActivityAt)).limit(100);
    const withUnread = rows.map((c) => ({ ...c, unreadCount: parseInt(c.unreadCount || "0", 10) }));
    const open = withUnread.filter((c) => c.status === "open").length;
    const totalUnread = withUnread.reduce((s, c) => s + c.unreadCount, 0);
    res.json({ conversations: withUnread, openCount: open, totalUnread });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// GET /api/conversations/:id/messages — message history (admin)
router.get("/conversations/:id/messages", requireAdmin, async (req, res) => {
  try {
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, String(req.params.id)));
    if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
    const messages = await db.select().from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversation.id))
      .orderBy(conversationMessagesTable.createdAt);
    // mark conversation read
    await db.update(conversationsTable).set({ unreadCount: "0" }).where(eq(conversationsTable.id, conversation.id));
    res.json({ conversation: { ...conversation, unreadCount: parseInt(conversation.unreadCount || "0", 10) }, messages });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// POST /api/conversations/:id/reply — seller replies (admin)
const replySchema = z.object({ content: z.string().trim().min(1).max(5000) });

router.post("/conversations/:id/reply", requireAdmin, async (req, res) => {
  const parsed = replySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Message is required." }); return; }
  try {
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, String(req.params.id)));
    if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
    await db.insert(conversationMessagesTable).values({
      id: generateId("msg"),
      conversationId: conversation.id,
      sender: "seller",
      content: parsed.data.content,
      isRead: true,
    });
    await db.update(conversationsTable)
      .set({ lastActivityAt: new Date(), status: "open" })
      .where(eq(conversationsTable.id, conversation.id));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send reply" });
  }
});

// POST /api/conversations/:id/close
router.post("/conversations/:id/close", requireAdmin, async (req, res) => {
  try {
    await db.update(conversationsTable).set({ status: "closed" }).where(eq(conversationsTable.id, String(req.params.id)));
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to close conversation" });
  }
});

// POST /api/conversations/:id/ai-draft — AI-suggested reply (admin)
router.post("/conversations/:id/ai-draft", requireAdmin, async (req, res) => {
  try {
    const [conversation] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, String(req.params.id)));
    if (!conversation) { res.status(404).json({ error: "Conversation not found" }); return; }
    const messages = await db.select().from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.conversationId, conversation.id))
      .orderBy(conversationMessagesTable.createdAt)
      .limit(10);

    const apiKey = process.env.Openrouter_API_KEY;
    if (!apiKey) { res.json({ draft: "Thanks for reaching out! Could you share more details so I can help better?" }); return; }

    const history = messages.map((m) => `${m.sender}: ${m.content}`).join("\n");
    const prompt = `You are Kena, assistant to Katenovas Collections. The seller asked you to draft a reply for this customer conversation. Write a warm, professional reply (1-3 sentences). Respond ONLY with the reply text.

CONVERSATION:
${history}`;

    const openai = new (await import("openai")).default({ baseURL: "https://openrouter.ai/api/v1", apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "openai/gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 180,
    });
    const draft = completion.choices[0]?.message?.content ?? "";
    res.json({ draft: draft.trim() });
  } catch (err: any) {
    req.log.error(err?.message);
    res.status(500).json({ error: "Failed to generate draft" });
  }
});

// POST /api/conversations/escalate — create conversation from AI escalation (public, rate-limited)
const escalateSchema = z.object({
  customerName: z.string().trim().min(1).max(120),
  customerEmail: z.string().trim().email().max(254),
  customerPhone: z.string().trim().max(40).optional().default(""),
  subject: z.string().trim().max(200).optional().default(""),
  message: z.string().trim().min(1).max(5000),
  relatedOrderId: z.string().max(100).optional().default(""),
  relatedProductId: z.string().max(100).optional().default(""),
  contactPreference: z.string().trim().max(50).optional().default(""),
});

const escalateAttempts = new Map<string, { count: number; resetAt: number }>();

router.post("/conversations/escalate", async (req, res) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = escalateAttempts.get(key);
  if (attempt && attempt.resetAt <= now) escalateAttempts.delete(key);
  const current = escalateAttempts.get(key);
  if (current && current.count >= 10) { res.status(429).json({ error: "Too many requests. Please try again later." }); return; }
  const next = escalateAttempts.get(key) ?? { count: 0, resetAt: now + 3600_000 };
  next.count += 1;
  escalateAttempts.set(key, next);

  const parsed = escalateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Please provide a name, email, and message." }); return; }

  try {
    const convId = generateId("conv");
    const subject = parsed.data.subject || "New message from customer";
    const fullSubject = parsed.data.contactPreference
      ? `${subject} (prefers ${parsed.data.contactPreference})`
      : subject;

    await db.insert(conversationsTable).values({
      id: convId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      subject: fullSubject,
      priority: "high",
      status: "open",
      unreadCount: "1",
      relatedOrderId: parsed.data.relatedOrderId,
      relatedProductId: parsed.data.relatedProductId,
      source: "ai_escalation",
    });

    await db.insert(conversationMessagesTable).values({
      id: generateId("msg"),
      conversationId: convId,
      sender: "customer",
      content: parsed.data.message,
      isRead: false,
    });

    // Notify seller in dashboard
    try {
      const { notificationsTable } = await import("@workspace/db");
      await db.insert(notificationsTable).values({
        id: generateId("nt"),
        type: "customer_message",
        title: "Customer needs help",
        message: `${parsed.data.customerName} requested human assistance: ${parsed.data.message.slice(0, 80)}`,
        relatedOrderId: parsed.data.relatedOrderId,
        relatedProductId: parsed.data.relatedProductId,
        isRead: false,
      });
    } catch {}

    res.status(201).json({ success: true, conversationId: convId });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

export default router;
