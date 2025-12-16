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
 * @description Web Server per l'applicazione
 */
const app = new Elysia()
  // Monta le routes del gestore dell'autenticazione
  .mount(auth.handler)
  // Monta la macro per la gestione dell'autenticazione
  .use(betterAuthMacro)

  // Caricamento routes
  .use(users)
  .use(uploads)
  .use(chats)
  .get("/", { online: true })

  // WebSocket per la comunicazione in tempo reale
  .ws("/ws", {
    // Query per il token di autenticazione (OTT)
    query: t.Object({
      token: t.String(),
    }),
    // Body per il messaggio (Client -> Server)
    body: t.Object({
      content: t.String(),
      receiver: t.String(),
      chatId: t.String(),
    }),
    // Risposte possibili dal server (Server -> Client)
    response: t.Union([
      // Messaggio testuale inviato dal server ad un client
      t.Object({
        type: t.Literal("message"),
        id: t.String(),
        content: t.String(), // Contenuto del messaggio cifrato
        sender: t.String(),
        timestamp: t.Number(),
        chatId: t.String(),
      }),
      // Connessione/disconnessione di un utente (online/offline)
      t.Object({
        type: t.Literal("connection"),
        user: t.String(),
        online: t.Boolean(),
      }),
      // Richiesta di aggiornamento della lista delle chat (Utilizzato quando un utente entra/esce da una chat)
      t.Object({
        type: t.Literal("refetch"),
      }),
    ]),
    // Listener chiamato alla connessione di un client
    async open(ws) {
      // Iscrivi il client alla lista broadcast per i messaggi rivolti all'utente (utilizzando il suo ID)
      ws.subscribe(ws.data.user.id);

      // Aggiunge la connessione al client alla lista delle connessioni attive
      const connections = connectedClients.get(ws.data.user.id) ?? [];
      connections.push(ws);
      connectedClients.set(ws.data.user.id, connections);

      // Ottiene la lista degli utenti con chat in comune con l'utente connesso
      const relatedUsers = await getRelatedUsers(ws.data.user.id);

      // Invia loro lo stato di online dell'utente che si è connesso
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
    // Listener chiamato alla disconnessione di un client
    async close(ws) {
      // Rimuove la connessione dal client dalla lista delle connessioni attive
      let connections = connectedClients.get(ws.data.user.id) ?? [];
      connections = connections.filter(
        (connection) =>
          connection !== ws && connection.readyState === WebSocket.OPEN
      );
      connectedClients.set(ws.data.user.id, connections);

      // Se non ci sono altre connessioni attive per l'utente, invia loro lo stato di offline
      if (connections.length === 0) {
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
      }
    },
    // Listener chiamato quando un client invia un messaggio
    async message(ws, message) {
      const [chatMember, receiverSessions] = await Promise.all([
        // Ottiene il record del membro della chat
        await db.query.chatMember.findFirst({
          columns: {
            chatId: true,
          },
          where: and(
            eq(schema.chatMember.chatId, message.chatId),
            eq(schema.chatMember.userId, ws.data.user.id)
          ),
        }),
        // Ottiene le sessioni dell'utente che ha ricevuto il messaggio
        await db.query.session.findMany({
          columns: {
            id: true,
          },
          where: eq(schema.session.userId, message.receiver),
        }),
      ]);

      // Se l'utente non è membro della chat, non inviare il messaggio
      if (!chatMember) return;

      // Genera un ID univoco per il messaggio
      const id = generateId();

      // Crea il messaggio da inviare al client
      const msg = {
        type: "message",
        id,
        content: message.content,
        sender: ws.data.user.id,
        timestamp: Date.now(),
        chatId: message.chatId,
      };

      // Invia il messaggio alle connessioni attive del destinatario via lista broadcast
      app.server?.publish(message.receiver, JSON.stringify(msg));

      // Ottiene le connessioni attive del destinatario
      const connections =
        connectedClients
          .get(message.receiver)
          ?.filter((connection) => connection.readyState === WebSocket.OPEN) ??
        [];

      // Se il numero di connessioni attive del destinatario è minore del numero di sessioni
      // significa che il destinatario ha dei dispositivi connessi non collegati
      if (connections.length < receiverSessions.length) {
        // Trova le sessioni mancanti
        const missingSessions = receiverSessions.filter(
          (session) =>
            !connections.some(
              (connection) =>
                (connection.data as { session: { id: string } }).session.id ===
                session.id
            )
        );

        // Inserisce il messaggio nella coda di messaggi da inviare
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

/**
 * @description Ottiene gli utenti con chat in comune con l'utente specificato
 * @param userId ID dell'utente
 * @returns Lista degli utenti con chat in comune
 */
async function getRelatedUsers(userId: string) {
  // Ottiene le chat dell'utente
  const userChats = await db
    .select({ chatId: schema.chatMember.chatId })
    .from(schema.chatMember)
    .where(eq(schema.chatMember.userId, userId));

  // Ottiene gli utenti con chat in comune con l'utente
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

  // Restituisce la lista degli utenti con chat in comune
  return usersWithChats;
}

console.log(`Server running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
