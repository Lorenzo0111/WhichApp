import { expoClient } from "@better-auth/expo/client";
import { keysClientPlugin } from "api/auth";
import { oneTimeTokenClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./constants";

/**
 * @description Client per la gestione dell'autenticazione
 */
export const authClient = createAuthClient({
  baseURL: API_BASE_URL,
  plugins: [
    usernameClient(),
    oneTimeTokenClient(),
    keysClientPlugin(),
    expoClient({
      scheme: "whichapp",
      storagePrefix: "whichapp",
      storage: SecureStore,
    }),
  ],
});
