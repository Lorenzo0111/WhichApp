import { and, eq, like, not, or } from "drizzle-orm";
import Elysia, { t } from "elysia";
import type { ElysiaWS } from "elysia/dist/ws";
import { user } from "../db/schema";
import { betterAuthMacro } from "../lib/auth/server";
import { db } from "../lib/db";

/**
 * @description Mappa delle connessioni attive degli utenti: [userId: ElysiaWS[]]
 */
export const connectedClients = new Map<string, ElysiaWS[]>();

/**
 * @description Routes per la gestione degli utenti
 */
export const users = new Elysia({ prefix: "/users" })
  // Monta la macro per la gestione dell'autenticazione
  .use(betterAuthMacro)
  // Route per ottenere le informazioni dell'utente corrente
  .get("/me", ({ user }) => user, { auth: true })
  // Route per cercare utenti
  .get(
    "/search",
    (context) => {
      return db
        .select({
          id: user.id,
          name: user.name,
          username: user.username,
          image: user.image,
        })
        .from(user)
        .where(
          and(
            or(
              like(user.name, `%${context.query.query}%`),
              like(user.username, `%${context.query.query}%`)
            ),
            not(eq(user.id, context.user.id))
          )
        )
        .limit(10);
    },
    {
      query: t.Object({
        query: t.String(),
      }),
      auth: true,
    }
  )
  .get(
    "/:id/online",
    ({ params }) => {
      // Ritorna true se l'utente ha almeno una connessione attiva
      return (
        (connectedClients
          .get(params.id)
          ?.filter((connection) => connection.readyState === WebSocket.OPEN)
          ?.length ?? 0) > 0
      );
    },
    { auth: true }
  );
