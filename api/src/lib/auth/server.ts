import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTimeToken, username } from "better-auth/plugins";
import Elysia from "elysia";
import { db } from "../db";
import { keysPlugin } from "./plugins";

/**
 * @description Authentication server configuration
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
  },
  experimental: { joins: true },
  trustedOrigins: [
    "whichapp://",

    ...(process.env.NODE_ENV === "development"
      ? [
          "exp://*/*",
          "exp://10.0.0.*:*/*",
          "exp://192.168.*.*:*/*",
          "exp://172.*.*.*:*/*",
          "exp://localhost:*/*",
        ]
      : []),
  ],
  plugins: [username(), oneTimeToken(), keysPlugin(), expo()],
  advanced: {
    disableOriginCheck: true,
  },
});

/**
 * @description Macro to handle authentication
 */
export const betterAuthMacro = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ status, query, request: { headers } }) {
      // Get an optional OTT present in the query
      const token = query.token;

      // Check if cookies are present in the request header
      if (headers.has("Cookie")) {
        // If present, authenticate via cookie
        const session = await auth.api.getSession({
          headers,
        });

        if (!session) return status(401);

        return {
          user: session.user,
          session: session.session,
        };
      }

      // If the OTT is not present, return 401
      if (!token) return status(401);

      // Otherwise, try to verify and authenticate via OTT
      try {
        const session = await auth.api.verifyOneTimeToken({ body: { token } });
        if (!session.user) return status(401);

        return session;
      } catch {
        return status(401);
      }
    },
  },
});
