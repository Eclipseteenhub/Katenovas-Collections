import { Router } from "express";
import { db, emailLogsTable, ordersTable, productsTable } from "@workspace/db";
import { desc, eq, gte, lt, sql } from "drizzle-orm";
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

// POST /api/email-logs/summary — send daily or weekly summary
router.post("/email-logs/summary", requireAdmin, async (req, res) => {
  const { period } = req.body as { period?: string };
  const isDaily = period !== "weekly";
  const now = new Date();
  let start: Date;
  if (isDaily) {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  } else {
    const day = now.getDay();
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day, 0, 0, 0);
  }

  try {
    const orders = await db.select().from(ordersTable).where(gte(ordersTable.createdAt, start));
    const paidOrders = orders.filter(o => o.paymentStatus === "success");
    const delivered = orders.filter(o => o.orderStatus === "Delivered");
    const cancelled = orders.filter(o => o.orderStatus === "Cancelled");
    const revenue = paidOrders.reduce((s, o) => s + parseFloat(o.totalAmount as string), 0);
    const uniqueCustomers = new Set(paidOrders.map(o => o.customerEmail)).size;

    // Top products
    const productCounts: Record<string, { name: string; qty: number }> = {};
    for (const o of paidOrders) {
      const items = o.items as Array<{ name: string; qty: number }>;
      for (const item of items) {
        if (!productCounts[item.name]) productCounts[item.name] = { name: item.name, qty: 0 };
        productCounts[item.name].qty += item.qty;
      }
    }
    const topProducts = Object.values(productCounts).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Low stock
    const allProducts = await db.select().from(productsTable).where(eq(productsTable.inStock, true));
    const lowStock = allProducts
      .filter(p => (p.stockCount ?? 0) <= 5)
      .map(p => ({ name: p.name, stock: p.stockCount ?? 0 }));

    const summary: emailService.BusinessSummary = {
      period: isDaily ? "daily" : "weekly",
      revenue,
      orders: orders.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
      paidOrders: paidOrders.length,
      newCustomers: uniqueCustomers,
      topProducts,
      lowStock,
    };

    const result = await emailService.sendBusinessSummary(summary);
    res.json({ success: result.success, error: result.error, summary });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

export default router;
