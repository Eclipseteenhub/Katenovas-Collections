import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const notificationsTable = pgTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // new_order, payment_success, payment_failed, status_shipped, status_delivered, low_stock, review, customer_message
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedOrderId: text("related_order_id").default("").notNull(),
  relatedProductId: text("related_product_id").default("").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;
