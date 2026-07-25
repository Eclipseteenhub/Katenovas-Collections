import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailLogsTable = pgTable("email_logs", {
  id: text("id").primaryKey(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  emailType: text("email_type").notNull(),
  status: text("status").notNull().default("sent"),
  errorMessage: text("error_message").default("").notNull(),
  relatedOrderId: text("related_order_id").default("").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogsTable.$inferSelect;
