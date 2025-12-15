import { treaty } from "@elysiajs/eden";
import type { App } from "api";
import { authClient } from "./auth";
import { API_BASE_URL } from "./constants";

const client = treaty<App>(API_BASE_URL, {
  headers() {
    return {
      Cookie: authClient.getCookie(),
    };
  },
});

export default client;
