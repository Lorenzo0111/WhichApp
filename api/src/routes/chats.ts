import { and, eq, inArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import * as schema from "../db/schema";
import { chat, chatMember } from "../db/schema";
import { betterAuthMacro } from "../lib/auth/server";
import { db } from "../lib/db";

export const chats = new Elysia({ prefix: "/chats" })
  .use(betterAuthMacro)
  .get(
    "/",
    async (context) => {
      const chats = await db
        .select({
          id: chat.id,
          name: chat.name,
          image: chat.image,
          createdAt: chat.createdAt,
        })
        .from(chat)
        .innerJoin(chatMember, eq(chat.id, chatMember.chatId))
        .where(eq(chatMember.userId, context.user.id));

      return await Promise.all(
        chats.map(async (c) => {
          if (c.name && c.image) return { ...c, name: c.name };

          const members = await db
            .select({
              id: chatMember.userId,
              name: schema.user.name,
              image: schema.user.image,
            })
            .from(chatMember)
            .innerJoin(schema.user, eq(chatMember.userId, schema.user.id))
            .where(eq(chatMember.chatId, c.id));

          return {
            ...c,
            name:
              members
                .filter((m) => m.id !== context.user.id)
                .map((m) => m.name)
                .join(", ") || "Chat",
            image:
              c.image ?? members.find((m) => m.id !== context.user.id)?.image,
          };
        })
      );
    },
    { auth: true }
  )
  .post(
    "/",
    async (context) => {
      const members = [...context.body.members, context.user.id];

      const potentialChats = await db
        .select({
          chatId: chatMember.chatId,
        })
        .from(chatMember)
        .where(inArray(chatMember.userId, members))
        .groupBy(chatMember.chatId)
        .having(sql`count(*) = ${members.length}`);

      const memberNames = await db
        .select({
          name: schema.user.name,
        })
        .from(schema.user)
        .where(
          inArray(
            schema.user.id,
            members.filter((m) => m !== context.user.id)
          )
        );

      for (const { chatId } of potentialChats) {
        const chatMembers = await db
          .select({
            userId: chatMember.userId,
          })
          .from(chatMember)
          .where(eq(chatMember.chatId, chatId));

        if (chatMembers.length === members.length) {
          const chatMemberIds = chatMembers.map((m) => m.userId).sort();
          const requestMemberIds = [...members].sort();

          const isExactMatch = chatMemberIds.every(
            (id, i) => id === requestMemberIds[i]
          );

          if (isExactMatch) {
            const existingChat = await db.query.chat.findFirst({
              where: eq(chat.id, chatId),
            });
            return existingChat
              ? {
                  ...existingChat,
                  name:
                    existingChat.name ||
                    memberNames.map((m) => m.name).join(", ") ||
                    "Chat",
                }
              : null;
          }
        }
      }

      const [newChat] = await db
        .insert(schema.chat)
        .values({
          image: null,
          createdAt: new Date(),
        })
        .returning();

      await db.insert(schema.chatMember).values(
        members.map((userId) => ({
          chatId: newChat.id,
          userId,
        }))
      );

      return newChat
        ? {
            ...newChat,
            name:
              newChat.name ||
              memberNames.map((m) => m.name).join(", ") ||
              "Chat",
          }
        : null;
    },
    {
      body: t.Object({
        members: t.Array(t.String()),
      }),
      response: t.Nullable(
        t.Object({
          id: t.String(),
          name: t.String(),
          image: t.Nullable(t.String()),
          createdAt: t.Date(),
        })
      ),
      auth: true,
    }
  )
  .get(
    "/:id",
    async (context) => {
      const { id } = context.params;

      const result = await db.query.chat.findFirst({
        where: eq(chat.id, id),
        with: {
          members: {
            with: {
              user: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  image: true,
                  publicKeyE: true,
                  publicKeyN: true,
                },
              },
            },
          },
        },
      });

      if (
        !result ||
        !result.members.find((member) => member.userId === context.user.id)
      )
        return context.status(404);

      return {
        ...result,
        members: result.members.map((member) => member.user),
        name:
          result.name ||
          result.members
            .filter((member) => member.userId !== context.user.id)
            .map((member) => member.user.name)
            .join(", ") ||
          "Chat",
        image:
          result.image ??
          result.members
            .filter((member) => member.userId !== context.user.id)
            .map((member) => member.user.image)
            .find((image) => image !== null) ??
          null,
      };
    },
    { auth: true }
  )
  .get(
    "/:id/messages",
    async (context) => {
      const { id } = context.params;

      const messages = await db
        .delete(schema.messageQueue)
        .where(
          and(
            eq(schema.messageQueue.chatId, id),
            eq(schema.messageQueue.receiver, context.user.id),
            eq(schema.messageQueue.receiverSession, context.session.id)
          )
        )
        .returning();

      return messages;
    },
    { auth: true }
  )
  .patch(
    "/:id",
    async (context) => {
      const { id } = context.params;

      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      if (!isMember) {
        context.set.status = 403;
        return { error: "Not a member of this chat" };
      }

      const [updatedChat] = await db
        .update(chat)
        .set({
          name: context.body.name,
          image: context.body.image,
        })
        .where(eq(chat.id, id))
        .returning();

      return updatedChat;
    },
    {
      body: t.Object({
        name: t.Optional(t.String()),
        image: t.Optional(t.Nullable(t.String())),
      }),
      auth: true,
    }
  )
  .post(
    "/:id/members",
    async (context) => {
      const { id } = context.params;

      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      if (!isMember)
        return context.status(403, { error: "Not a member of this chat" });

      const existingMembers = await db
        .select({ userId: chatMember.userId })
        .from(chatMember)
        .where(eq(chatMember.chatId, id));

      const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

      const newMembers = context.body.userIds.filter(
        (userId) => !existingMemberIds.has(userId)
      );

      if (newMembers.length === 0) return { added: 0 };

      await db.insert(chatMember).values(
        newMembers.map((userId) => ({
          chatId: id,
          userId,
        }))
      );

      return { added: newMembers.length };
    },
    {
      body: t.Object({
        userIds: t.Array(t.String()),
      }),
      auth: true,
    }
  )
  .delete(
    "/:id",
    async (context) => {
      const { id } = context.params;

      const membership = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      if (!membership)
        return context.status(403, { error: "Not a member of this chat" });

      const removed = await db
        .delete(chatMember)
        .where(
          and(eq(chatMember.chatId, id), eq(chatMember.userId, context.user.id))
        )
        .returning();

      const hasMembers = await db.query.chatMember.findFirst({
        where: eq(chatMember.chatId, id),
      });

      if (!hasMembers) {
        await db
          .delete(schema.messageQueue)
          .where(eq(schema.messageQueue.chatId, id));
        await db.delete(chat).where(eq(chat.id, id));
      }

      return { left: removed.length > 0 };
    },
    { auth: true }
  );
