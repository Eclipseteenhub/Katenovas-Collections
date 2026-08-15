import { Router, type IRouter } from "express";
import { db, emailLogsTable, ordersTable, productsTable } from "@workspace/db";
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import * as emailService from "../services/email";

const router: IRouter = Router();

const initializeSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1), qty: z.number().int().positive() }))
    .min(1),
  customer: z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(5).max(40),
    email: z.string().trim().email().max(254),
    address: z.string().trim().min(1).max(500),
    state: z.string().trim().max(100).optional().default(""),
    city: z.string().trim().max(100).optional().default(""),
    landmark: z.string().trim().max(200).optional().default(""),
  }),
});

type OrderItem = { id: string; name: string; price: number; qty: number };

class CheckoutError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

class InventoryConflictError extends Error {}

function generateId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getPaystackKey(): string | undefined {
  return process.env.Paystack_Secret_Live_API_KEY || process.env.PAYSTACK_SECRET_KEY;
}

function getCallbackUrl(): string {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin) {
    throw new CheckoutError("Online checkout is not configured yet", 500);
  }

  try {
    return new URL("/order-success.html", new URL(configuredOrigin).origin).toString();
  } catch {
    throw new CheckoutError("Online checkout is not configured yet", 500);
  }
}

function publicOrder(order: typeof ordersTable.$inferSelect) {
  return {
    id: order.id,
    reference: order.paystackReference,
    amount: Number(order.totalAmount),
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    createdAt: order.createdAt,
  };
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
  } catch {
    // An email-log failure must never change a paid order.
  }
}

function emailOrder(order: typeof ordersTable.$inferSelect): emailService.OrderForEmail {
  return {
    id: order.id,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerAddress: order.customerAddress,
    items: order.items as OrderItem[],
    totalAmount: Number(order.totalAmount),
    paystackReference: order.paystackReference,
    orderStatus: order.orderStatus,
  };
}

function queuePaidEmails(order: typeof ordersTable.$inferSelect) {
  const data = emailOrder(order);
  void Promise.all([
    emailService.sendOrderConfirmation(data).then((result) =>
      logEmail({
        id: generateId("el"), recipient: order.customerEmail,
        subject: "Order Confirmation", emailType: "order_confirmation",
        status: result.success ? "sent" : "failed", errorMessage: result.error ?? "",
        relatedOrderId: order.id,
      }),
    ),
    emailService.sendNewOrderAlert(data).then((result) =>
      logEmail({
        id: generateId("el"), recipient: process.env.ADMIN_EMAIL ?? "",
        subject: "New Order Alert", emailType: "new_order_alert",
        status: result.success ? "sent" : "failed", errorMessage: result.error ?? "",
        relatedOrderId: order.id,
      }),
    ),
  ]).catch(() => undefined);
}

function queueStockReviewAlert(order: typeof ordersTable.$inferSelect) {
  void emailService.sendNewOrderAlert(emailOrder(order)).then((result) =>
    logEmail({
      id: generateId("el"), recipient: process.env.ADMIN_EMAIL ?? "",
      subject: "PAID ORDER: stock review required", emailType: "stock_review_alert",
      status: result.success ? "sent" : "failed", errorMessage: result.error ?? "",
      relatedOrderId: order.id,
    }),
  ).catch(() => undefined);
}

// POST /api/checkout/initialize
router.post("/checkout/initialize", async (req, res) => {
  const parsed = initializeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please check your checkout details and try again." });
    return;
  }

  const secretKey = getPaystackKey();
  if (!secretKey) {
    req.log.error("Paystack secret key not configured");
    res.status(500).json({ error: "Online payment is not configured yet." });
    return;
  }

  try {
    const { items, customer } = parsed.data;
    if (new Set(items.map((item) => item.id)).size !== items.length) {
      throw new CheckoutError("Your cart contains duplicate products. Please refresh it and try again.");
    }

    const products = await db.select().from(productsTable)
      .where(inArray(productsTable.id, items.map((item) => item.id)));
    if (products.length !== items.length) {
      throw new CheckoutError("One or more products are no longer available. Please update your cart.");
    }

    const orderItems: OrderItem[] = [];
    let total = 0;
    for (const item of items) {
      const product = products.find((row) => row.id === item.id);
      if (!product || !product.inStock || product.stockCount < item.qty) {
        throw new CheckoutError(`${product?.name ?? "A product"} no longer has enough stock. Please update your cart.`);
      }
      const price = Number(product.price);
      if (!Number.isFinite(price) || price <= 0) {
        req.log.error({ productId: product.id }, "Invalid stored product price");
        throw new CheckoutError("One product cannot be checked out right now. Please contact us.", 500);
      }
      orderItems.push({ id: product.id, name: product.name, price, qty: item.qty });
      total += price * item.qty;
    }

    const callbackUrl = getCallbackUrl();
    const orderId = generateId("ord");
    const reference = generateId("kc");
    await db.insert(ordersTable).values({
      id: orderId, customerName: customer.name, customerPhone: customer.phone,
      customerEmail: customer.email, customerAddress: customer.address,
      customerState: customer.state, customerCity: customer.city, customerLandmark: customer.landmark,
      items: orderItems, totalAmount: total.toFixed(2), paystackReference: reference,
      paymentStatus: "pending", orderStatus: "Pending",
    });

    let paystackData: any;
    let paystackResponse: Awaited<ReturnType<typeof fetch>>;
    try {
      paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          email: customer.email, amount: Math.round(total * 100), reference, callback_url: callbackUrl,
          metadata: { orderId },
        }),
      });
      paystackData = await paystackResponse.json();
    } catch (error) {
      req.log.error(error, "Paystack initialization request failed");
      await db.update(ordersTable).set({ paymentStatus: "abandoned", orderStatus: "Cancelled", updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));
      res.status(502).json({ error: "Could not start payment. Please try again." });
      return;
    }

    if (!paystackResponse.ok || !paystackData?.status || !paystackData?.data?.authorization_url) {
      req.log.error({ status: paystackResponse.status }, "Paystack initialization rejected");
      await db.update(ordersTable).set({ paymentStatus: "abandoned", orderStatus: "Cancelled", updatedAt: new Date() })
        .where(eq(ordersTable.id, orderId));
      res.status(502).json({ error: "Could not start payment. Please try again." });
      return;
    }

    res.status(201).json({ authorizationUrl: paystackData.data.authorization_url, reference, amount: total });
  } catch (error) {
    if (error instanceof CheckoutError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    req.log.error(error, "Checkout initialization failed");
    res.status(500).json({ error: "Checkout is temporarily unavailable. Please try again." });
  }
});

// GET /api/checkout/verify/:reference
router.get("/checkout/verify/:reference", async (req, res) => {
  const secretKey = getPaystackKey();
  if (!secretKey) {
    res.status(500).json({ error: "Online payment is not configured yet." });
    return;
  }

  const reference = String(req.params.reference);
  try {
    const [order] = await db.select().from(ordersTable)
      .where(eq(ordersTable.paystackReference, reference));
    if (!order) {
      res.status(404).json({ error: "Payment reference not found." });
      return;
    }
    if (order.paymentStatus === "success") {
      res.json({ status: "success", order: publicOrder(order) });
      return;
    }

    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${secretKey}` } },
    );
    const verifyData: any = await verifyResponse.json().catch(() => null);
    if (!verifyResponse.ok || !verifyData?.status) {
      req.log.error({ status: verifyResponse.status, reference }, "Paystack verification failed");
      res.status(502).json({ error: "We could not verify this payment yet. Please try again shortly." });
      return;
    }

    if (verifyData?.data?.status !== "success") {
      const [updated] = await db.update(ordersTable)
        .set({ paymentStatus: "failed", updatedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.paymentStatus, "pending")))
        .returning();
      res.json({ status: "failed", order: publicOrder(updated ?? order) });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        // Claim the order first. Only the request that changes pending -> processing can adjust stock or send email.
        const [claimed] = await tx.update(ordersTable)
          .set({ paymentStatus: "processing", updatedAt: new Date() })
          .where(and(eq(ordersTable.id, order.id), eq(ordersTable.paymentStatus, "pending")))
          .returning();
        if (!claimed) {
          const [current] = await tx.select().from(ordersTable).where(eq(ordersTable.id, order.id));
          if (!current) throw new Error("Order disappeared during payment verification");
          return { order: current, transitioned: false };
        }

        for (const item of claimed.items as OrderItem[]) {
          const updatedStock = await tx.update(productsTable)
            .set({
              stockCount: sql`${productsTable.stockCount} - ${item.qty}`,
              inStock: sql`CASE WHEN ${productsTable.stockCount} - ${item.qty} > 0 THEN true ELSE false END`,
            })
            .where(and(eq(productsTable.id, item.id), eq(productsTable.inStock, true), gte(productsTable.stockCount, item.qty)))
            .returning({ id: productsTable.id });
          if (updatedStock.length !== 1) throw new InventoryConflictError();
        }

        const [paid] = await tx.update(ordersTable)
          .set({ paymentStatus: "success", updatedAt: new Date() })
          .where(eq(ordersTable.id, order.id))
          .returning();
        if (!paid) throw new Error("Order could not be finalized after stock adjustment");
        return { order: paid, transitioned: true };
      });

      if (result.transitioned) queuePaidEmails(result.order);
      res.json({ status: result.order.paymentStatus === "success" ? "success" : "pending", order: publicOrder(result.order) });
    } catch (error) {
      if (!(error instanceof InventoryConflictError)) throw error;
      // The charge is genuine, but stock changed after checkout initialization. Do not oversell or falsely call it unpaid.
      const [reviewOrder] = await db.update(ordersTable)
        .set({ paymentStatus: "success", orderStatus: "Stock Review Required", updatedAt: new Date() })
        .where(and(eq(ordersTable.id, order.id), eq(ordersTable.paymentStatus, "pending")))
        .returning();
      if (reviewOrder) queueStockReviewAlert(reviewOrder);
      res.json({ status: "success", requiresSupport: true, order: publicOrder(reviewOrder ?? order) });
    }
  } catch (error) {
    req.log.error(error, "Payment verification failed");
    res.status(500).json({ error: "We could not verify this payment right now. Please try again shortly." });
  }
});

export default router;

