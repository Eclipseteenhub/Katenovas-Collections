import {
  pgTable,
  text,
  numeric,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const orderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  qty: z.number().int().positive(),
});

export const ordersTable = pgTable("orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerAddress: text("customer_address").notNull(),
  customerState: text("customer_state").default("").notNull(),
  customerCity: text("customer_city").default("").notNull(),
  customerLandmark: text("customer_landmark").default("").notNull(),
  items: jsonb("items").$type<z.infer<typeof orderItemSchema>[]>().notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  paystackReference: text("paystack_reference").notNull().unique(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderStatus: text("order_status").notNull().default("Pending"),
  sellerNotes: text("seller_notes").default("").notNull(),
  courierName: text("courier_name").default("").notNull(),
  trackingNumber: text("tracking_number").default("").notNull(),
  dispatchDate: timestamp("dispatch_date"),
  estimatedDelivery: timestamp("estimated_delivery"),
  shippingCost: numeric("shipping_cost", { precision: 12, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;

export const orderStatusValues = [
  "Pending",
  "Processing",
  "Ready for Dispatch",
  "Shipped",
  "Out for Delivery",
  "Delivered",
  "Cancelled",
] as const;

export const paymentStatusValues = [
  "pending",
  "processing",
  "success",
  "failed",
  "abandoned",
] as const;
