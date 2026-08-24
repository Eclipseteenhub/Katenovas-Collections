import { Router } from "express";
import { db, emailLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";
import * as emailService from "../services/email";

const router = Router();
const manualEmailSchema = z.object({
  recipient: z.string().trim().email().max(254),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(20_000),
  relatedOrderId: z.string().max(100).optional().default(""),
});

// GET /api/email-logs
router.get("/email-logs", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(emailLogsTable)
      .orderBy(desc(emailLogsTable.createdAt))
      .limit(200);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch email logs" });
  }
});

// POST /api/email-logs/test — send a test email
router.post("/email-logs/test", requireAdmin, async (req, res) => {
  try {
    const result = await emailService.testConnection();
    res.json({ success: result.success, error: result.error });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

router.post("/email-logs/send", requireAdmin, async (req, res) => {
  const parsed = manualEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Recipient, subject, and message are required." });
    return;
  }

  const { recipient, subject, message, relatedOrderId } = parsed.data;
  const result = await emailService.sendManualEmail({ recipient, subject, message });
  try {
    const [log] = await db.insert(emailLogsTable).values({
      id: "email_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      recipient,
      subject,
      emailType: "manual",
      status: result.success ? "sent" : "failed",
      errorMessage: result.error || "",
      relatedOrderId,
    }).returning();
    if (!result.success) {
      res.status(502).json({ error: result.error || "Email could not be sent.", log });
      return;
    }
    res.status(201).json({ success: true, log });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Email was sent but could not be logged." });
  }
});

export default router;
