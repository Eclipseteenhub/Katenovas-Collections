import { Router, type IRouter } from "express";
import { db, productsTable, ordersTable, emailLogsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import * as emailService from "../services/email";

const router: IRouter = Router();

const initializeSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), qty: z.number().int().positive() }))
    .min(1),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    email: z.string().email(),
    address: z.string().min(1),
    state: z.string().optional().default(""),
    city: z.string().optional().default(""),
    landmark: z.string().optional().default(""),
  }),
  callbackUrl: z.string().url(),
});

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getPaystackKey(): string | undefined {
  return (
    process.env.Paystack_Secret_Live_API_KEY ||
    process.env.PAYSTACK_SECRET_KEY
  );
}

async function logEmail(params: {
  id: string;
  recipient: string;
  subject: string;
  emailType: string;
  status: string;
  errorMessage: string;
  relatedOrderId: string;
}) {
  try {
    await db.insert(emailLogsTable).values(params);
  } catch {}
}

// POST /api/checkout/initialize
router.post("/checkout/initialize", async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid checkout data" });
    return;
  }

  const { items, customer, callbackUrl } = parsed.data;
  const secretKey = getPaystackKey();

  if (!secretKey) {
    req.log.error("Paystack secret key not configured");
    res.status(500).json({ error: "Online payment is not configured yet" });
    return;
  }

  try {
    const ids = items.map((i) => i.id);
    const rows = await db.select().from(productsTable).where(inArray(productsTable.id, ids));

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
      customerState: customer.state,
      customerCity: customer.city,
      customerLandmark: customer.landmark,
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
  const secretKey = getPaystackKey();
  if (!secretKey) {
    res.status(500).json({ error: "Online payment is not configured yet" });
    return;
  }

  const reference = String(req.params.reference);

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

    // Fire emails asynchronously — do not block the response
    if (newPaymentStatus === "success") {
      const orderData: emailService.OrderForEmail = {
        id: updated.id,
        customerName: updated.customerName,
        customerEmail: updated.customerEmail,
        customerPhone: updated.customerPhone,
        customerAddress: updated.customerAddress,
        items: updated.items as emailService.OrderForEmail["items"],
        totalAmount: parseFloat(updated.totalAmount),
        paystackReference: updated.paystackReference,
        orderStatus: updated.orderStatus,
      };

      Promise.all([
        emailService.sendOrderConfirmation(orderData).then((r) =>
          logEmail({
            id: generateId("el"),
            recipient: updated.customerEmail,
            subject: "Order Confirmation",
            emailType: "order_confirmation",
            status: r.success ? "sent" : "failed",
            errorMessage: r.error ?? "",
            relatedOrderId: updated.id,
          }),
        ),
        emailService.sendNewOrderAlert(orderData).then((r) =>
          logEmail({
            id: generateId("el"),
            recipient: process.env.ADMIN_EMAIL ?? "eghenovakate@gmail.com",
            subject: "New Order Alert",
            emailType: "new_order_alert",
            status: r.success ? "sent" : "failed",
            errorMessage: r.error ?? "",
            relatedOrderId: updated.id,
          }),
        ),
      ]).catch(() => {});
    }

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
    customerState: o.customerState,
    customerCity: o.customerCity,
    customerLandmark: o.customerLandmark,
    items: o.items,
    totalAmount: parseFloat(o.totalAmount),
    paystackReference: o.paystackReference,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    createdAt: o.createdAt,
  };
}

export default router;
