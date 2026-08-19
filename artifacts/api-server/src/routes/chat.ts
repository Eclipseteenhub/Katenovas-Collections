import { Router } from "express";
import OpenAI from "openai";
import { db, productsTable } from "@workspace/db";
import { z } from "zod";

const router = Router();

const chatAttempts = new Map<string, { count: number; resetAt: number }>();
const CHAT_WINDOW_MS = 60 * 60 * 1000;
const MAX_CHAT_REQUESTS_PER_WINDOW = 30;

const SYSTEM_PROMPT = `You are Kena, a friendly and knowledgeable shopping assistant for Katenovas Collections — a Nigerian fashion and lifestyle brand based in Benin City.

BUSINESS INFORMATION:
- Name: Katenovas Collections
- Address: 141, Uppermission Extension, Aduwawa, Benin City, Edo State, Nigeria 300211
- WhatsApp: +234 802 549 7647
- Email: eghenovakate@gmail.com
- TikTok: @katenovascollections
- Available 24/7 for orders, enquiries, and support
- Nationwide delivery across Nigeria
- Categories: Clothes, Jewelry, Home Accessories, Shoes, Bags

PAYMENT OPTIONS:
- Online via Paystack (debit cards, bank transfer, USSD) — secure Nigerian payment platform
- WhatsApp order — browse products, add to cart, tap "Order via WhatsApp"
- Instant email confirmation after payment

DELIVERY:
- Nationwide delivery across Nigeria
- Time and cost depend on customer's location
- Contact via WhatsApp for a delivery quote for your area
- Orders dispatched within 24 hours of payment confirmation

RETURNS:
- Accepted within 48 hours of delivery
- Item must be unused, unworn, in original packaging with tags
- Contact WhatsApp to start a return

INSTRUCTIONS:
- Be warm, conversational, and helpful — like a friendly in-store assistant
- Use the product catalog below to answer questions about availability, prices, and categories
- Recommend products when customers describe what they're looking for
- If you can't answer confidently, say so and offer to connect them with the seller
- Keep responses concise — 2–4 sentences is ideal
- Use ₦ for Nigerian Naira
- NEVER invent prices, stock information, or policies not provided here

HUMAN HANDOFF:
If a customer says they want to speak to a human, the seller, a person, or if they say "talk to seller", "human", "real person", or similar — respond ONLY with this exact JSON and nothing else:
{"handoff":true,"message":"Of course! I'll connect you with Kate right away. Tap the WhatsApp button below to start a conversation 💬"}`;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(20),
});

// POST /api/chat
router.post("/chat", async (req, res) => {
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const attempt = chatAttempts.get(key);
  if (attempt && attempt.resetAt <= now) chatAttempts.delete(key);
  const current = chatAttempts.get(key);
  if (current && current.count >= MAX_CHAT_REQUESTS_PER_WINDOW) {
    res.status(429).json({ error: "You have reached the chat limit. Please try again later." });
    return;
  }
  const next = chatAttempts.get(key) ?? { count: 0, resetAt: now + CHAT_WINDOW_MS };
  next.count += 1;
  chatAttempts.set(key, next);

  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  const apiKey = process.env.Openrouter_API_KEY;
  if (!apiKey) {
    req.log.warn("Openrouter_API_KEY not configured");
    res.status(503).json({
      reply: "The AI assistant is not configured yet. Please WhatsApp us at +234 802 549 7647 for immediate help!",
      error: true,
    });
    return;
  }

  try {
    const openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://katenovascollections.replit.app",
        "X-Title": "Katenovas Collections",
      },
    });

    const products = await db
      .select({
        name: productsTable.name,
        price: productsTable.price,
        category: productsTable.category,
        description: productsTable.description,
        inStock: productsTable.inStock,
      })
      .from(productsTable);

    const productContext =
      products.length > 0
        ? "\n\nCURRENT PRODUCT CATALOG:\n" +
          products
            .map(
              (p) =>
                `• ${p.name} (${p.category}) — ₦${parseFloat(p.price).toLocaleString("en-NG")} — ${p.inStock ? "In Stock ✓" : "Out of Stock"} — ${p.description || "No description"}`,
            )
            .join("\n")
        : "\n\nNo products currently listed.";

    const completion = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + productContext },
        ...parsed.data.messages,
      ],
      max_tokens: 350,
      temperature: 0.7,
    });

    const reply =
      completion.choices[0]?.message?.content ??
      "I'm having trouble responding right now. Please WhatsApp us at +234 802 549 7647 for immediate help!";

    // Check for handoff signal
    try {
      const obj = JSON.parse(reply);
      if (obj.handoff === true) {
        res.json({ reply: obj.message, handoff: true });
        return;
      }
    } catch {}

    res.json({ reply });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "Chat error");
    res
      .status(500)
      .json({
        reply:
          "I'm having trouble connecting right now. Please WhatsApp us at +234 802 549 7647 for help!",
        error: true,
      });
  }
});

export default router;
