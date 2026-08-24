import { Router, type IRouter } from "express";
import { db, notificationsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

// GET /api/notifications — admin only, latest 50
router.get("/notifications", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50);
    const unread = rows.filter(r => !r.isRead).length;
    res.json({ notifications: rows, unreadCount: unread });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/notifications/:id/read", requireAdmin, async (req, res) => {
  try {
    const [row] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, String(req.params.id))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/notifications/read-all
router.patch("/notifications/read-all", requireAdmin, async (req, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true });
    res.json({ success: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;

export function createNotification(data: { type: string; title: string; message: string; relatedOrderId?: string; relatedProductId?: string }) {
  const id = `nt_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  db.insert(notificationsTable).values({
    id,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedOrderId: data.relatedOrderId || "",
    relatedProductId: data.relatedProductId || "",
    isRead: false,
  }).catch(() => {});
}
