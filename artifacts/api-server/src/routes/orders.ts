import { Router, type IRouter } from "express";
import { db, ordersTable, orderStatusValues, emailLogsTable } from "@workspace/db";
import { desc, eq, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";
import * as emailService from "../services/email";

const router: IRouter = Router();

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function serialize(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    customerAddress: o.customerAddress,
    customerState: o.customerState,
    customerCity: o.customerCity,
    customerLandmark: o.customerLandmark,
    items: o.items,
    totalAmount: parseFloat(o.totalAmount),
    paystackReference: o.paystackReference,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    sellerNotes: o.sellerNotes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

// GET /api/orders?search=
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        search
          ? or(
              ilike(ordersTable.customerName, `%${search}%`),
              ilike(ordersTable.customerPhone, `%${search}%`),
              ilike(ordersTable.paystackReference, `%${search}%`),
              ilike(ordersTable.customerEmail, `%${search}%`),
            )
          : undefined,
      )
      .orderBy(desc(ordersTable.createdAt));

    res.json(rows.map(serialize));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

const updateOrderSchema = z.object({
  orderStatus: z.enum(orderStatusValues).optional(),
  sellerNotes: z.string().max(2000).optional(),
});

// PATCH /api/orders/:id
router.patch("/orders/:id", requireAdmin, async (req, res) => {
  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update data" });
    return;
  }

  const updates: Partial<typeof ordersTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.orderStatus !== undefined)
    updates.orderStatus = parsed.data.orderStatus;
  if (parsed.data.sellerNotes !== undefined)
    updates.sellerNotes = parsed.data.sellerNotes;

  try {
    const [existing] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.id, String(req.params.id)));
    if (!existing) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    const [row] = await db
      .update(ordersTable)
      .set(updates)
      .where(eq(ordersTable.id, String(req.params.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Send status update email asynchronously (only if status changed)
    if (
      parsed.data.orderStatus &&
      parsed.data.orderStatus !== existing.orderStatus &&
      row.paymentStatus === "success"
    ) {
      const orderData: emailService.OrderForEmail = {
        id: row.id,
        customerName: row.customerName,
        customerEmail: row.customerEmail,
        customerPhone: row.customerPhone,
        customerAddress: row.customerAddress,
        items: row.items as emailService.OrderForEmail["items"],
        totalAmount: parseFloat(row.totalAmount),
        paystackReference: row.paystackReference,
        orderStatus: row.orderStatus,
      };

      emailService
        .sendStatusUpdate(orderData, parsed.data.orderStatus)
        .then((r) =>
          db
            .insert(emailLogsTable)
            .values({
              id: generateId("el"),
              recipient: row.customerEmail,
              subject: `Order Update: ${parsed.data.orderStatus}`,
              emailType: "status_update",
              status: r.success ? "sent" : "failed",
              errorMessage: r.error ?? "",
              relatedOrderId: row.id,
            })
            .catch(() => {}),
        )
        .catch(() => {});
    }

    res.json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
