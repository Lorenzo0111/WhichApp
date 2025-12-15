import { generateId } from "better-auth";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// --------------------[ AUTH ]--------------------

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$onUpdate(() => new Date())
    .notNull(),
  username: text("username").unique(),
  displayUsername: text("display_username"),
  publicKeyE: text("public_key_e").notNull(),
  publicKeyN: text("public_key_n").notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  chatMembers: many(chatMember),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// --------------------[ CHAT ]--------------------
export const chat = sqliteTable("chat", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => generateId()),
  name: text("name"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const chatsRelations = relations(chat, ({ many }) => ({
  members: many(chatMember),
}));

export const chatMember = sqliteTable(
  "chat_member",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.chatId] })]
);

export const chatMemberRelations = relations(chatMember, ({ one }) => ({
  chat: one(chat, {
    fields: [chatMember.chatId],
    references: [chat.id],
  }),
  user: one(user, {
    fields: [chatMember.userId],
    references: [user.id],
  }),
}));

export const messageQueue = sqliteTable(
  "message_queue",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    encryptedContent: text("encrypted_content").notNull(),
    sender: text("sender")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiver: text("receiver")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    receiverSession: text("receiver_session")
      .notNull()
      .references(() => session.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    index("message_queue_receiver_idx").on(t.receiver),
    index("message_queue_receiver_session_idx").on(t.receiverSession),
  ]
);

export const messageQueueRelations = relations(messageQueue, ({ one }) => ({
  chat: one(chat, {
    fields: [messageQueue.chatId],
    references: [chat.id],
  }),
  sender: one(user, {
    fields: [messageQueue.sender],
    references: [user.id],
  }),
  receiver: one(user, {
    fields: [messageQueue.receiver],
    references: [user.id],
  }),
  receiverSession: one(session, {
    fields: [messageQueue.receiverSession],
    references: [session.id],
  }),
}));
