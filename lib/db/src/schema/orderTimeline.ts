import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const orderTimelineTable = pgTable("order_timeline", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  status: text("status").notNull(),
  note: text("note").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OrderTimeline = typeof orderTimelineTable.$inferSelect;
