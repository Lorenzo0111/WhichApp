import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTimeToken, username } from "better-auth/plugins";
import Elysia from "elysia";
import { db } from "../db";
import { keysPlugin } from "./plugins";

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

export const betterAuthMacro = new Elysia({ name: "better-auth" }).macro({
  auth: {
    async resolve({ status, query, request: { headers } }) {
      const token = query.token;

      if (headers.has("Cookie")) {
        const session = await auth.api.getSession({
          headers,
        });

        if (!session) return status(401);

        return {
          user: session.user,
          session: session.session,
        };
      }

      if (!token) return status(401);

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
