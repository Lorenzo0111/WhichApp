import { and, eq, inArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import * as schema from "../db/schema";
import { chat, chatMember } from "../db/schema";
import { betterAuthMacro } from "../lib/auth/server";
import { db } from "../lib/db";

/**
 * @description Routes to handle chats
 */
export const chats = new Elysia({ prefix: "/chats" })
  // Mount the authentication macro
  .use(betterAuthMacro)
  // Route to get the chats of the current user
  .get(
    "/",
    async (context) => {
      // Get the chats of the current user
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
        // Map the chats
        chats.map(async (c) => {
          // If the chat has both a custom name and image, return the normal chat
          if (c.name && c.image) return c;

          // Get the members of the chat
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
            // Set the name of the chat to the list of members
            name:
              members
                .filter((m) => m.id !== context.user.id)
                .map((m) => m.name)
                .join(", ") || "Chat",
            // Set the image of the chat to the first image of the member that is not the current user
            image:
              c.image ?? members.find((m) => m.id !== context.user.id)?.image,
          };
        }),
      );
    },
    { auth: true },
  )
  // Route to create a new chat
  .post(
    "/",
    async (context) => {
      // Set the members of the chat to the ones provided plus the current user
      const members = [...context.body.members, context.user.id];

      // Search for potential chats with the same members
      const potentialChats = await db
        .select({
          chatId: chatMember.chatId,
        })
        .from(chatMember)
        .where(inArray(chatMember.userId, members))
        .groupBy(chatMember.chatId)
        .having(sql`count(*) = ${members.length}`);

      // Check if there is an exact chat with the provided members
      for (const { chatId } of potentialChats) {
        // Get the members of the chat
        const chatMembers = await db
          .select({
            userId: chatMember.userId,
          })
          .from(chatMember)
          .where(eq(chatMember.chatId, chatId));

        if (chatMembers.length === members.length) {
          const chatMemberIds = chatMembers.map((m) => m.userId).sort();
          const requestMemberIds = [...members].sort();

          // Check if the chat has exactly the provided members
          const isExactMatch = chatMemberIds.every(
            (id, i) => id === requestMemberIds[i],
          );

          // If there is an exact match, return the ID of the chat
          if (isExactMatch) return chatId;
        }
      }

      // Create a new chat
      const [newChat] = await db
        .insert(schema.chat)
        .values({
          image: null,
          createdAt: new Date(),
        })
        .returning();

      // Add the members to the chat
      await db.insert(schema.chatMember).values(
        members.map((userId) => ({
          chatId: newChat.id,
          userId,
        })),
      );

      // Publish the update of the chat for all members
      for (const userId of members) {
        context.server?.publish(
          userId,
          JSON.stringify({
            type: "refetch",
          }),
        );
      }

      // Return the ID of the new chat
      return newChat.id;
    },
    {
      body: t.Object({
        members: t.Array(t.String()),
      }),
      auth: true,
    },
  )
  // Route to get a chat
  .get(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Get the chat
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

      // Check if the chat exists and if the current user is a member of the chat
      if (
        !result ||
        !result.members.find((member) => member.userId === context.user.id)
      )
        return context.status(404);

      // Return the chat
      return {
        ...result,
        members: result.members.map((member) => member.user),
        // Set the name of the chat to the list of members
        name:
          result.name ||
          result.members
            .filter((member) => member.userId !== context.user.id)
            .map((member) => member.user.name)
            .join(", ") ||
          "Chat",
        // Set the image of the chat to the first image of the member that is not the current user
        image:
          result.image ??
          result.members
            .filter((member) => member.userId !== context.user.id)
            .map((member) => member.user.image)
            .find((image) => image !== null) ??
          null,
      };
    },
    { auth: true },
  )
  // Route to get the pending messages for a chat
  .get(
    "/:id/messages",
    async (context) => {
      const { id } = context.params;

      // Get the pending messages for the chat
      const messages = await db
        .delete(schema.messageQueue)
        .where(
          and(
            eq(schema.messageQueue.chatId, id),
            eq(schema.messageQueue.receiver, context.user.id),
            eq(schema.messageQueue.receiverSession, context.session.id),
          ),
        )
        .returning();

      return messages;
    },
    { auth: true },
  )
  // Route to update the information of a chat
  .patch(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Check if the current user is a member of the chat
      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id),
        ),
      });

      // If the user is not a member, return an error
      if (!isMember) {
        context.set.status = 403;
        return { error: "Not a member of this chat" };
      }

      // Update the information of the chat
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
    },
  )
  // Route to add a member to a chat
  .post(
    "/:id/members",
    async (context) => {
      const { id } = context.params;

      // Check if the current user is a member of the chat
      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id),
        ),
      });

      // If the user is not a member, return an error
      if (!isMember)
        return context.status(403, { error: "Not a member of this chat" });

      // Get the members of the chat
      const existingMembers = await db
        .select({ userId: chatMember.userId })
        .from(chatMember)
        .where(eq(chatMember.chatId, id));

      // Find the new members
      const newMembers = context.body.userIds.filter(
        (userId) => !existingMembers.some((m) => m.userId === userId),
      );

      // If there are no new members, return 0
      if (newMembers.length === 0) return { added: 0 };

      // Add the new members to the chat
      await db.insert(chatMember).values(
        newMembers.map((userId) => ({
          chatId: id,
          userId,
        })),
      );

      // Publish the update of the chat for all new members
      for (const userId of newMembers) {
        context.server?.publish(
          userId,
          JSON.stringify({
            type: "refetch",
          }),
        );
      }

      // Return the number of members added
      return { added: newMembers.length };
    },
    {
      body: t.Object({
        userIds: t.Array(t.String()),
      }),
      auth: true,
    },
  )
  // Route to remove a member from a chat
  .delete(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Check if the current user is a member of the chat
      const membership = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id),
        ),
      });

      // If the user is not a member, return an error
      if (!membership)
        return context.status(403, { error: "Not a member of this chat" });

      // Remove the member from the chat
      const removed = await db
        .delete(chatMember)
        .where(
          and(
            eq(chatMember.chatId, id),
            eq(chatMember.userId, context.user.id),
          ),
        )
        .returning();

      // Check if the chat has members
      const hasMembers = await db.query.chatMember.findFirst({
        where: eq(chatMember.chatId, id),
      });

      // If there are no members, remove the chat
      if (!hasMembers) {
        await db
          .delete(schema.messageQueue)
          .where(eq(schema.messageQueue.chatId, id));
        await db.delete(chat).where(eq(chat.id, id));
      }

      // Publish the update of the chat for all removed members
      for (const user of removed) {
        context.server?.publish(
          user.userId,
          JSON.stringify({
            type: "refetch",
          }),
        );
      }

      return { left: removed.length > 0 };
    },
    { auth: true },
  );
