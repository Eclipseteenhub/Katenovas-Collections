import { Resend } from "resend";
import { logger } from "../lib/logger";

const resend = new Resend(process.env.Resend_API_KEY);

const FROM =
  process.env.RESEND_FROM_EMAIL ??
  "Katenovas Collections <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "eghenovakate@gmail.com";
const WA_LINK = "https://wa.me/2348025497647";

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Georgia,serif;background:#f5f0eb;color:#333}
.outer{max-width:600px;margin:0 auto;padding:20px}
.card{background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)}
.hdr{background:#6B1A25;padding:28px 32px;text-align:center}
.hdr h1{color:#B8944A;font-size:22px;letter-spacing:1px;margin-bottom:4px}
.hdr p{color:rgba(255,255,255,0.75);font-size:13px}
.bdy{padding:32px}
.bdy h2{color:#6B1A25;font-size:20px;margin-bottom:16px}
.bdy p{font-size:14px;line-height:1.7;margin-bottom:12px}
.btn{display:inline-block;background:#B8944A;color:#fff!important;text-decoration:none;padding:13px 28px;border-radius:5px;font-size:15px;font-weight:700;margin:8px 0}
.tbl{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
.tbl th{background:#f9f5f0;color:#6B1A25;text-align:left;padding:9px 12px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
.tbl td{padding:9px 12px;border-bottom:1px solid #f0ebe3}
.badge{display:inline-block;background:#f0ebe3;color:#6B1A25;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:700}
.divider{height:1px;background:#f0ebe3;margin:20px 0}
.total-row{text-align:right;font-size:16px;font-weight:700;color:#6B1A25;margin:12px 0}
.ftr{background:#2a2a2a;padding:20px 32px;text-align:center}
.ftr p{color:rgba(255,255,255,0.45);font-size:11px;margin:3px 0}
.ftr a{color:#B8944A;text-decoration:none}
@media(max-width:600px){.bdy{padding:20px}.hdr{padding:20px}}
</style>
</head>
<body>
<div class="outer">
<div class="card">
  <div class="hdr">
    <h1>Katenovas Collections</h1>
    <p>Fashion &amp; Lifestyle</p>
  </div>
  <div class="bdy">
    ${body}
  </div>
</div>
<div class="ftr">
  <p>141, Uppermission Extension, Aduwawa, Benin City, Edo State, Nigeria 300211</p>
  <p><a href="${WA_LINK}">WhatsApp: +234 802 549 7647</a> &bull; <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a></p>
  <p style="margin-top:10px;">&copy; 2026 Katenovas Collections. All rights reserved.</p>
</div>
</div>
</body>
</html>`;
}

export type OrderForEmail = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  items: { name: string; price: number; qty: number }[];
  totalAmount: number;
  paystackReference: string;
  orderStatus: string;
};

export type EmailResult = { success: boolean; id?: string; error?: string };

async function safeSend(
  params: Parameters<typeof resend.emails.send>[0],
  emailType: string,
): Promise<EmailResult> {
  if (!process.env.Resend_API_KEY) {
    logger.warn({ emailType }, "Resend API key not configured — skipping email");
    return { success: false, error: "Resend API key not configured" };
  }
  try {
    const result = await resend.emails.send(params);
    if (result.error) {
      logger.error({ emailType, error: result.error }, "Resend error");
      return { success: false, error: result.error.message };
    }
    logger.info({ emailType, id: result.data?.id }, "Email sent");
    return { success: true, id: result.data?.id };
  } catch (err: any) {
    logger.error({ emailType, err: err?.message }, "Email send exception");
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

export async function sendOrderConfirmation(order: OrderForEmail): Promise<EmailResult> {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${formatNaira(i.price)}</td><td style="text-align:right">${formatNaira(i.price * i.qty)}</td></tr>`,
    )
    .join("");

  const body = `
    <h2>🎉 Order Confirmed!</h2>
    <p>Hi <strong>${order.customerName}</strong>, thank you for shopping with us!</p>
    <p>Your payment has been verified and your order is now being processed. We'll be in touch soon!</p>
    <div class="divider"></div>
    <p><strong>Order Reference:</strong> <span class="badge">${order.paystackReference}</span></p>
    <table class="tbl">
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total-row">Total: ${formatNaira(order.totalAmount)}</p>
    <div class="divider"></div>
    <p><strong>📍 Delivery to:</strong><br/>${order.customerAddress}</p>
    <p>We'll contact you on <strong>${order.customerPhone}</strong> once your order is ready for dispatch.</p>
    <p>Questions? We're available 24/7 on WhatsApp.</p>
    <div class="divider"></div>
    <p style="text-align:center"><a href="${WA_LINK}" class="btn">Track Order on WhatsApp</a></p>
  `;

  return safeSend(
    {
      from: FROM,
      to: order.customerEmail,
      subject: `✅ Order Confirmed — Katenovas Collections`,
      html: baseTemplate("Order Confirmation", body),
    },
    "order_confirmation",
  );
}

export async function sendNewOrderAlert(order: OrderForEmail): Promise<EmailResult> {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${formatNaira(i.price * i.qty)}</td></tr>`,
    )
    .join("");

  const body = `
    <h2>🛒 New Order Received!</h2>
    <p>A customer just completed a payment on your store.</p>
    <div class="divider"></div>
    <p><strong>Customer:</strong> ${order.customerName}</p>
    <p><strong>Phone:</strong> <a href="https://wa.me/${order.customerPhone.replace(/\D/g, "")}">${order.customerPhone}</a></p>
    <p><strong>Email:</strong> ${order.customerEmail}</p>
    <p><strong>Delivery Address:</strong> ${order.customerAddress}</p>
    <p><strong>Reference:</strong> <span class="badge">${order.paystackReference}</span></p>
    <div class="divider"></div>
    <table class="tbl">
      <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total-row">Order Total: ${formatNaira(order.totalAmount)}</p>
    <div class="divider"></div>
    <p style="text-align:center"><a href="https://katenovascollections.replit.app/admin-dashboard.html" class="btn">View in Dashboard</a></p>
  `;

  return safeSend(
    {
      from: FROM,
      to: ADMIN_EMAIL,
      subject: `🛒 New Order — ${order.customerName} — ${formatNaira(order.totalAmount)}`,
      html: baseTemplate("New Order Alert", body),
    },
    "new_order_alert",
  );
}

const STATUS_COPY: Record<string, { emoji: string; headline: string; detail: string }> = {
  "Processing": {
    emoji: "⚙️",
    headline: "We're Preparing Your Order",
    detail: "Great news! Your order is now being carefully prepared and packaged. We'll notify you as soon as it's ready to ship.",
  },
  "Ready for Dispatch": {
    emoji: "📦",
    headline: "Your Order is Ready for Dispatch",
    detail: "Your package has been prepared and is ready to be dispatched. Our delivery team will pick it up shortly.",
  },
  "Shipped": {
    emoji: "🚚",
    headline: "Your Order Has Been Shipped!",
    detail: "Your order is on its way! Our delivery partner has picked up your package. We'll contact you with delivery details.",
  },
  "Out for Delivery": {
    emoji: "🛵",
    headline: "Out for Delivery Today!",
    detail: "Exciting news — your order is out for delivery today! Please make sure someone is available to receive it.",
  },
  "Delivered": {
    emoji: "🎉",
    headline: "Order Delivered Successfully!",
    detail: "Your order has been delivered! We hope you absolutely love your new items. Thank you for shopping with Katenovas Collections.",
  },
  "Cancelled": {
    emoji: "❌",
    headline: "Order Cancelled",
    detail: "Your order has been cancelled. If this was unexpected or you need assistance, please contact us on WhatsApp immediately and we'll sort it out.",
  },
};

export async function sendStatusUpdate(
  order: OrderForEmail,
  newStatus: string,
): Promise<EmailResult> {
  const info = STATUS_COPY[newStatus] ?? {
    emoji: "📋",
    headline: "Order Status Updated",
    detail: `Your order status has been updated to: <strong>${newStatus}</strong>.`,
  };

  const body = `
    <h2>${info.emoji} ${info.headline}</h2>
    <p>Hi <strong>${order.customerName}</strong>,</p>
    <p>${info.detail}</p>
    <div class="divider"></div>
    <p><strong>Order Reference:</strong> <span class="badge">${order.paystackReference}</span></p>
    <p><strong>Current Status:</strong> <span class="badge">${newStatus}</span></p>
    <div class="divider"></div>
    <p>Need help? We're available 24/7 — just tap below.</p>
    <p style="text-align:center"><a href="${WA_LINK}" class="btn">Chat on WhatsApp</a></p>
  `;

  return safeSend(
    {
      from: FROM,
      to: order.customerEmail,
      subject: `${info.emoji} Order Update: ${newStatus} — Katenovas Collections`,
      html: baseTemplate("Order Status Update", body),
    },
    "status_update",
  );
}

export async function testConnection(): Promise<EmailResult> {
  const body = `
    <h2>✅ Email System Connected!</h2>
    <p>Your Resend email integration is working correctly.</p>
    <p>Customers will now receive order confirmation emails automatically after payment, and you'll receive instant alerts for every new order.</p>
    <div class="divider"></div>
    <p>Email notifications enabled:</p>
    <ul style="margin:12px 0;padding-left:20px;font-size:14px;line-height:2">
      <li>✅ Order confirmation to customer</li>
      <li>✅ New order alert to seller</li>
      <li>✅ Order status updates to customer</li>
    </ul>
  `;
  return safeSend(
    {
      from: FROM,
      to: ADMIN_EMAIL,
      subject: "✅ Katenovas Email System — Connected Successfully",
      html: baseTemplate("Email Test", body),
    },
    "test",
  );
}
