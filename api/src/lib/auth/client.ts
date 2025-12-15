import { BetterAuthClientPlugin } from "better-auth";
import { keysPlugin } from "./plugins";

export const keysClientPlugin = () => {
  return {
    id: "keys",
    $InferServerPlugin: {} as ReturnType<typeof keysPlugin>,
  } satisfies BetterAuthClientPlugin;
};
