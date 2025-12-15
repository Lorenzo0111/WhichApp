import type { BetterAuthPlugin } from "better-auth/types";

export const keysPlugin = () => {
  return {
    id: "keys",
    schema: {
      user: {
        fields: {
          publicKeyE: {
            type: "string",
            required: true,
            unique: true,
          },
          publicKeyN: {
            type: "string",
            required: true,
            unique: true,
          },
        },
      },
    },
  } satisfies BetterAuthPlugin;
};
