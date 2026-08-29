import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const conversationsTable = pgTable("conversations", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").default("").notNull(),
  customerEmail: text("customer_email").default("").notNull(),
  customerPhone: text("customer_phone").default("").notNull(),
  subject: text("subject").default("").notNull(),
  priority: text("priority").default("normal").notNull(), // low, normal, high
  status: text("status").default("open").notNull(), // open, closed
  unreadCount: text("unread_count").default("0").notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  relatedOrderId: text("related_order_id").default("").notNull(),
  relatedProductId: text("related_product_id").default("").notNull(),
  source: text("source").default("ai_escalation").notNull(), // ai_escalation, whatsapp, support
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversationMessagesTable = pgTable("conversation_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  sender: text("sender").notNull(), // customer, seller, ai
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationMessage = typeof conversationMessagesTable.$inferSelect;
