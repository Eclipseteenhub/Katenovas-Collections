import { Router } from "express";
import { db, emailLogsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";
import * as emailService from "../services/email";

const router = Router();

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

export default router;
