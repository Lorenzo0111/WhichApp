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

/**
 * @description Web Server for the application
 */
const app = new Elysia()
  // Mount the authentication handler routes
  .mount(auth.handler)
  // Mount the authentication macro
  .use(betterAuthMacro)

  // Load routes
  .use(users)
  .use(uploads)
  .use(chats)
  .get("/", { online: true })

  // WebSocket for real-time communication
  .ws("/ws", {
    // Query for the authentication token (OTT)
    query: t.Object({
      token: t.String(),
    }),
    // Body for the message (Client -> Server)
    body: t.Object({
      content: t.String(),
      receiver: t.String(),
      chatId: t.String(),
    }),
    // Possible responses from the server (Server -> Client)
    response: t.Union([
      // Text message sent from the server to a client
      t.Object({
        type: t.Literal("message"),
        id: t.String(),
        content: t.String(), // Encrypted message content
        sender: t.String(),
        timestamp: t.Number(),
        chatId: t.String(),
      }),
      // Connection/disconnection of a user (online/offline)
      t.Object({
        type: t.Literal("connection"),
        user: t.String(),
        online: t.Boolean(),
      }),
      // Request to update the list of chats (Used when a user enters/exits a chat)
      t.Object({
        type: t.Literal("refetch"),
      }),
    ]),
    // Listener called when a client connects
    async open(ws) {
      // Subscribe the client to the broadcast list for messages addressed to the user (using its ID)
      ws.subscribe(ws.data.user.id);

      // Add the connection to the client to the list of active connections
      const connections = connectedClients.get(ws.data.user.id) ?? [];
      connections.push(ws);
      connectedClients.set(ws.data.user.id, connections);

      // Get the list of users with chat in common with the connected user
      const relatedUsers = await getRelatedUsers(ws.data.user.id);

      // Send their online status to the user that connected
      for (const user of relatedUsers) {
        app.server?.publish(
          user.id,
          JSON.stringify({
            type: "connection",
            user: ws.data.user.id,
            online: true,
          }),
        );
      }
    },
    // Listener called when a client disconnects
    async close(ws) {
      // Remove the connection from the client from the list of active connections
      let connections = connectedClients.get(ws.data.user.id) ?? [];
      connections = connections.filter(
        (connection) =>
          connection !== ws && connection.readyState === WebSocket.OPEN,
      );
      connectedClients.set(ws.data.user.id, connections);

      // If there are no other active connections for the user, send them the offline status
      if (connections.length === 0) {
        const relatedUsers = await getRelatedUsers(ws.data.user.id);
        for (const user of relatedUsers) {
          app.server?.publish(
            user.id,
            JSON.stringify({
              type: "connection",
              user: ws.data.user.id,
              online: false,
            }),
          );
        }
      }
    },
    // Listener called when a client sends a message
    async message(ws, message) {
      const [chatMember, receiverSessions] = await Promise.all([
        // Get the record of the chat member
        await db.query.chatMember.findFirst({
          columns: {
            chatId: true,
          },
          where: and(
            eq(schema.chatMember.chatId, message.chatId),
            eq(schema.chatMember.userId, ws.data.user.id),
          ),
        }),
        // Get the sessions of the user that received the message
        await db.query.session.findMany({
          columns: {
            id: true,
          },
          where: eq(schema.session.userId, message.receiver),
        }),
      ]);

      // If the user is not a member of the chat, do not send the message
      if (!chatMember) return;

      // Generate a unique ID for the message
      const id = generateId();

      // Create the message to send to the client
      const msg = {
        type: "message",
        id,
        content: message.content,
        sender: ws.data.user.id,
        timestamp: Date.now(),
        chatId: message.chatId,
      };

      // Send the message to the active connections of the recipient via broadcast list
      app.server?.publish(message.receiver, JSON.stringify(msg));

      // Get the active connections of the recipient
      const connections =
        connectedClients
          .get(message.receiver)
          ?.filter((connection) => connection.readyState === WebSocket.OPEN) ??
        [];

      // If the number of active connections of the recipient is less than the number of sessions
      // means that the recipient has devices connected not connected
      if (connections.length < receiverSessions.length) {
        // Find the missing sessions
        const missingSessions = receiverSessions.filter(
          (session) =>
            !connections.some(
              (connection) =>
                (connection.data as { session: { id: string } }).session.id ===
                session.id,
            ),
        );

        // Insert the message into the queue of messages to send
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
            })),
          )
          .execute();
      }
    },
    auth: true,
  })
  .listen(3000);

/**
 * @description Get the users with chat in common with the specified user
 * @param userId ID of the user
 * @returns List of users with chat in common
 */
async function getRelatedUsers(userId: string) {
  // Get the chats of the user
  const userChats = await db
    .select({ chatId: schema.chatMember.chatId })
    .from(schema.chatMember)
    .where(eq(schema.chatMember.userId, userId));

  // Get the users with chat in common with the user
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
          userChats.map((chat) => chat.chatId),
        ),
      ),
    );

  // Return the list of users with chat in common
  return usersWithChats;
}

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
