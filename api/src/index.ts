import { generateId } from "better-auth";
import "dotenv/config";
import { and, eq, inArray, ne } from "drizzle-orm";
import { Elysia, t } from "elysia";
import * as schema from "./db/schema";
import { auth, betterAuthMacro } from "./lib/auth/server";
import { db } from "./lib/db";
import { chats } from "./routes/chats";
import { uploads } from "./routes/uploads";
import { connectedClients, users } from "./routes/users";

const app = new Elysia()
  .mount(auth.handler)
  .use(betterAuthMacro)
  .use(users)
  .use(uploads)
  .use(chats)
  .get("/", { online: true })
  .ws("/ws", {
    query: t.Object({
      token: t.String(),
    }),
    body: t.Object({
      content: t.String(),
      receiver: t.String(),
      chatId: t.String(),
    }),
    response: t.Union([
      t.Object({
        type: t.Literal("message"),
        id: t.String(),
        content: t.String(),
        sender: t.String(),
        timestamp: t.Number(),
        chatId: t.String(),
      }),
      t.Object({
        type: t.Literal("connection"),
        user: t.String(),
        online: t.Boolean(),
      }),
    ]),
    async open(ws) {
      ws.subscribe(ws.data.user.id);

      const connections = connectedClients.get(ws.data.user.id) ?? [];
      connections.push(ws);
      connectedClients.set(ws.data.user.id, connections);

      const relatedUsers = await getRelatedUsers(ws.data.user.id);
      for (const user of relatedUsers) {
        app.server?.publish(
          user.id,
          JSON.stringify({
            type: "connection",
            user: ws.data.user.id,
            online: true,
          })
        );
      }
    },
    async close(ws) {
      const connections = connectedClients.get(ws.data.user.id) ?? [];
      connections.filter((connection) => connection !== ws);
      connectedClients.set(ws.data.user.id, connections);

      const relatedUsers = await getRelatedUsers(ws.data.user.id);
      for (const user of relatedUsers) {
        app.server?.publish(
          user.id,
          JSON.stringify({
            type: "connection",
            user: ws.data.user.id,
            online: false,
          })
        );
      }
    },
    async message(ws, message) {
      const [chatMember, receiverSessions] = await Promise.all([
        await db.query.chatMember.findFirst({
          columns: {
            chatId: true,
          },
          where: and(
            eq(schema.chatMember.chatId, message.chatId),
            eq(schema.chatMember.userId, ws.data.user.id)
          ),
        }),
        await db.query.session.findMany({
          columns: {
            id: true,
          },
          where: eq(schema.session.userId, message.receiver),
        }),
      ]);

      if (!chatMember) return;

      const id = generateId();

      const msg = {
        type: "message",
        id,
        content: message.content,
        sender: ws.data.user.id,
        timestamp: Date.now(),
        chatId: message.chatId,
      };

      app.server?.publish(message.receiver, JSON.stringify(msg));

      const connections =
        connectedClients
          .get(message.receiver)
          ?.filter((connection) => connection.readyState === WebSocket.OPEN) ??
        [];

      if (connections.length < receiverSessions.length) {
        const missingSessions = receiverSessions.filter(
          (session) =>
            !connections.some(
              (connection) =>
                (connection.data as { session: { id: string } }).session.id ===
                session.id
            )
        );

        await db
          .insert(schema.messageQueue)
          .values(
            missingSessions.map((session) => ({
              id,
              chatId: message.chatId,
              encryptedContent: message.content,
              sender: ws.data.user.id,
              receiver: message.receiver,
              receiverSession: session.id,
            }))
          )
          .execute();
      }
    },
    auth: true,
  })
  .listen(3000);

async function getRelatedUsers(userId: string) {
  const userChats = await db
    .select({ chatId: schema.chatMember.chatId })
    .from(schema.chatMember)
    .where(eq(schema.chatMember.userId, userId));

  const usersWithChats = await db
    .selectDistinct({
      id: schema.user.id,
    })
    .from(schema.user)
    .innerJoin(schema.chatMember, eq(schema.chatMember.userId, schema.user.id))
    .where(
      and(
        ne(schema.user.id, userId),
        inArray(
          schema.chatMember.chatId,
          userChats.map((chat) => chat.chatId)
        )
      )
    );

  return usersWithChats;
}

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
