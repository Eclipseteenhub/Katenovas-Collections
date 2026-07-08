import { Router, type IRouter } from "express";
import { db, productsTable, ordersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const initializeSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        qty: z.number().int().positive(),
      }),
    )
    .min(1),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    address: z.string().min(1),
  }),
  callbackUrl: z.string().url(),
});

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// POST /api/checkout/initialize
router.post("/checkout/initialize", async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid checkout data" });
    return;
  }

  const { items, customer, callbackUrl } = parsed.data;
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    req.log.error("PAYSTACK_SECRET_KEY not configured");
    res.status(500).json({ error: "Online payment is not configured yet" });
    return;
  }

  try {
    const ids = items.map((i) => i.id);
    const rows = await db
      .select()
      .from(productsTable)
      .where(inArray(productsTable.id, ids));

    const orderItems = [];
    let total = 0;

    for (const item of items) {
      const product = rows.find((p) => p.id === item.id);
      if (!product) {
        res.status(400).json({ error: `Product ${item.id} not found` });
        return;
      }
      if (!product.inStock) {
        res.status(400).json({ error: `${product.name} is out of stock` });
        return;
      }
      const price = parseFloat(product.price);
      total += price * item.qty;
      orderItems.push({ id: product.id, name: product.name, price, qty: item.qty });
    }

    if (total <= 0) {
      res.status(400).json({ error: "Order total must be greater than zero" });
      return;
    }

    const orderId = generateId("ord");
    const reference = generateId("kc");

    await db.insert(ordersTable).values({
      id: orderId,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      customerAddress: customer.address,
      items: orderItems,
      totalAmount: total.toFixed(2),
      paystackReference: reference,
      paymentStatus: "pending",
      orderStatus: "Pending",
    });

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: customer.email,
        amount: Math.round(total * 100),
        reference,
        callback_url: callbackUrl,
        metadata: {
          orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
        },
      }),
    });

    const paystackData: any = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      req.log.error(paystackData);
      res.status(502).json({ error: "Failed to start payment. Please try again." });
      return;
    }

    res.status(201).json({
      authorizationUrl: paystackData.data.authorization_url,
      reference,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to initialize checkout" });
  }
});

// GET /api/checkout/verify/:reference
router.get("/checkout/verify/:reference", async (req, res) => {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    res.status(500).json({ error: "Online payment is not configured yet" });
    return;
  }

  const { reference } = req.params;

  try {
    const [order] = await db
      .select()
      .from(ordersTable)
      .where(eq(ordersTable.paystackReference, reference));

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    if (order.paymentStatus === "success") {
      res.json({ status: "success", order: serializeOrder(order) });
      return;
    }

    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const verifyData: any = await verifyRes.json();

    const paystackStatus = verifyData?.data?.status;
    const newPaymentStatus = paystackStatus === "success" ? "success" : "failed";

    const [updated] = await db
      .update(ordersTable)
      .set({ paymentStatus: newPaymentStatus, updatedAt: new Date() })
      .where(eq(ordersTable.id, order.id))
      .returning();

    res.json({ status: newPaymentStatus, order: serializeOrder(updated) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to verify payment" });
  }
});

function serializeOrder(o: typeof ordersTable.$inferSelect) {
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

export default router;
