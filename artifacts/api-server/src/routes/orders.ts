import { Router, type IRouter } from "express";
import { db, ordersTable, orderStatusValues } from "@workspace/db";
import { desc, eq, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middleware/requireAdmin";

const router: IRouter = Router();

function serialize(o: typeof ordersTable.$inferSelect) {
  return {
    id: o.id,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    customerEmail: o.customerEmail,
    customerAddress: o.customerAddress,
    items: o.items,
    totalAmount: parseFloat(o.totalAmount),
    paystackReference: o.paystackReference,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    createdAt: o.createdAt,
  };
}

// GET /api/orders?search=
router.get("/orders", requireAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const rows = await db
      .select()
      .from(ordersTable)
      .where(
        search
          ? or(
              ilike(ordersTable.customerName, `%${search}%`),
              ilike(ordersTable.customerPhone, `%${search}%`),
              ilike(ordersTable.paystackReference, `%${search}%`),
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

const updateStatusSchema = z.object({
  orderStatus: z.enum(orderStatusValues),
});

// PATCH /api/orders/:id
router.patch("/orders/:id", requireAdmin, async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order status" });
    return;
  }

  try {
    const [row] = await db
      .update(ordersTable)
      .set({ orderStatus: parsed.data.orderStatus, updatedAt: new Date() })
      .where(eq(ordersTable.id, String(req.params.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

export default router;
