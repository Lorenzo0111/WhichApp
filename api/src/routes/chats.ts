import { and, eq, inArray, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import * as schema from "../db/schema";
import { chat, chatMember } from "../db/schema";
import { betterAuthMacro } from "../lib/auth/server";
import { db } from "../lib/db";

/**
 * @description Routes per la gestione delle chat
 */
export const chats = new Elysia({ prefix: "/chats" })
  // Monta la macro per la gestione dell'autenticazione
  .use(betterAuthMacro)
  // Route per ottenere le chat dell'utente corrente
  .get(
    "/",
    async (context) => {
      // Ottiene le chat dell'utente corrente
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
        // Mappa le chat
        chats.map(async (c) => {
          // Se la chat ha sia un nome che un'immagine personalizzati, ritorna la chat normale
          if (c.name && c.image) return c;

          // Ottiene i membri della chat
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
            // Imposta il nome della chat alla lista dei membri
            name:
              members
                .filter((m) => m.id !== context.user.id)
                .map((m) => m.name)
                .join(", ") || "Chat",
            // Imposta l'immagine della chat alla prima immagine del membro che non è l'utente corrente
            image:
              c.image ?? members.find((m) => m.id !== context.user.id)?.image,
          };
        })
      );
    },
    { auth: true }
  )
  // Route per creare una nuova chat
  .post(
    "/",
    async (context) => {
      // Imposta i membri della chat a quelli forniti più l'utente corrente
      const members = [...context.body.members, context.user.id];

      // Cerca potenziali chat con stessi membri
      const potentialChats = await db
        .select({
          chatId: chatMember.chatId,
        })
        .from(chatMember)
        .where(inArray(chatMember.userId, members))
        .groupBy(chatMember.chatId)
        .having(sql`count(*) = ${members.length}`);

      // Controlla se esiste una chat esatta con i membri forniti
      for (const { chatId } of potentialChats) {
        // Ottiene i membri della chat
        const chatMembers = await db
          .select({
            userId: chatMember.userId,
          })
          .from(chatMember)
          .where(eq(chatMember.chatId, chatId));

        if (chatMembers.length === members.length) {
          const chatMemberIds = chatMembers.map((m) => m.userId).sort();
          const requestMemberIds = [...members].sort();

          // Controlla se la chat ha esattamente i membri forniti
          const isExactMatch = chatMemberIds.every(
            (id, i) => id === requestMemberIds[i]
          );

          // In caso di esatta corrispondenza, ritorna l'ID della chat
          if (isExactMatch) return chatId;
        }
      }

      // Crea una nuova chat
      const [newChat] = await db
        .insert(schema.chat)
        .values({
          image: null,
          createdAt: new Date(),
        })
        .returning();

      // Aggiunge i membri alla chat
      await db.insert(schema.chatMember).values(
        members.map((userId) => ({
          chatId: newChat.id,
          userId,
        }))
      );

      // Pubblica l'aggiornamento della chat per tutti i membri
      for (const userId of members) {
        context.server?.publish(
          userId,
          JSON.stringify({
            type: "refetch",
          })
        );
      }

      // Ritorna l'ID della nuova chat
      return newChat.id;
    },
    {
      body: t.Object({
        members: t.Array(t.String()),
      }),
      auth: true,
    }
  )
  // Route per ottenere una chat
  .get(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Ottiene la chat
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

      // Controlla se la chat esiste e se l'utente corrente è membro della chat
      if (
        !result ||
        !result.members.find((member) => member.userId === context.user.id)
      )
        return context.status(404);

      // Ritorna la chat
      return {
        ...result,
        members: result.members.map((member) => member.user),
        // Imposta il nome della chat alla lista dei membri
        name:
          result.name ||
          result.members
            .filter((member) => member.userId !== context.user.id)
            .map((member) => member.user.name)
            .join(", ") ||
          "Chat",
        // Imposta l'immagine della chat alla prima immagine del membro che non è l'utente corrente
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
  // Route per ottenere i messaggi in sospeso per una chat
  .get(
    "/:id/messages",
    async (context) => {
      const { id } = context.params;

      // Ottiene i messaggi in sospeso per la chat
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
  // Route per aggiornare le informazioni di una chat
  .patch(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Controlla se l'utente corrente è membro della chat
      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      // In caso di non membro, ritorna un errore
      if (!isMember) {
        context.set.status = 403;
        return { error: "Not a member of this chat" };
      }

      // Aggiorna le informazioni della chat
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
  // Route per aggiungere un membro a una chat
  .post(
    "/:id/members",
    async (context) => {
      const { id } = context.params;

      // Controlla se l'utente corrente è membro della chat
      const isMember = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      // In caso di non membro, ritorna un errore
      if (!isMember)
        return context.status(403, { error: "Not a member of this chat" });

      // Ottiene i membri della chat
      const existingMembers = await db
        .select({ userId: chatMember.userId })
        .from(chatMember)
        .where(eq(chatMember.chatId, id));

      // Trova i nuovi membri
      const newMembers = context.body.userIds.filter(
        (userId) => !existingMembers.some((m) => m.userId === userId)
      );

      // In caso di nessun nuovo membro, ritorna 0
      if (newMembers.length === 0) return { added: 0 };

      // Aggiunge i nuovi membri alla chat
      await db.insert(chatMember).values(
        newMembers.map((userId) => ({
          chatId: id,
          userId,
        }))
      );

      // Pubblica l'aggiornamento della chat per tutti i nuovi membri
      for (const userId of newMembers) {
        context.server?.publish(
          userId,
          JSON.stringify({
            type: "refetch",
          })
        );
      }

      // Ritorna il numero di membri aggiunti
      return { added: newMembers.length };
    },
    {
      body: t.Object({
        userIds: t.Array(t.String()),
      }),
      auth: true,
    }
  )
  // Route per rimuovere un membro da una chat
  .delete(
    "/:id",
    async (context) => {
      const { id } = context.params;

      // Controlla se l'utente corrente è membro della chat
      const membership = await db.query.chatMember.findFirst({
        where: and(
          eq(chatMember.chatId, id),
          eq(chatMember.userId, context.user.id)
        ),
      });

      // In caso di non membro, ritorna un errore
      if (!membership)
        return context.status(403, { error: "Not a member of this chat" });

      // Rimuove il membro dalla chat
      const removed = await db
        .delete(chatMember)
        .where(
          and(eq(chatMember.chatId, id), eq(chatMember.userId, context.user.id))
        )
        .returning();

      // Controlla se la chat ha ancora membri
      const hasMembers = await db.query.chatMember.findFirst({
        where: eq(chatMember.chatId, id),
      });

      // In caso di assenza di membri, rimuove la chat
      if (!hasMembers) {
        await db
          .delete(schema.messageQueue)
          .where(eq(schema.messageQueue.chatId, id));
        await db.delete(chat).where(eq(chat.id, id));
      }

      // Pubblica l'aggiornamento della chat per tutti i membri rimossi
      for (const user of removed) {
        context.server?.publish(
          user.userId,
          JSON.stringify({
            type: "refetch",
          })
        );
      }

      return { left: removed.length > 0 };
    },
    { auth: true }
  );
