import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const message = sqliteTable(
  "message",
  {
    id: text("id").primaryKey(),
    content: text("content").notNull(),
    sender: text("sender").notNull(),
    timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
    chatId: text("chat_id").notNull(),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [index("message_chat_id_idx").on(table.chatId)]
);
