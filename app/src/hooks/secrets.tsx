import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { decryptString, encryptString } from "@/lib/crypto";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface PrivateKeyState {
  loading: boolean;
  value: boolean;
  refetch: () => Promise<void>;
}

const PrivateKeyContext = createContext<PrivateKeyState | null>(null);

export function PrivateKeyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending, data: session } = authClient.useSession();
  const [hasPrivateKey, setHasPrivateKey] = useState({
    loading: true,
    value: false,
  });

  const checkKeys = useCallback(async () => {
    if (isPending) {
      setHasPrivateKey({ loading: true, value: false });
      return;
    }

    if (!session) {
      setHasPrivateKey({ loading: false, value: false });
      return;
    }

    try {
      const [d, n] = await Promise.all([
        await SecureStore.getItemAsync(PRIVATE_KEY_D(session.user.id), {
          requireAuthentication: true,
        }),
        await SecureStore.getItemAsync(PRIVATE_KEY_N(session.user.id), {
          requireAuthentication: true,
        }),
      ]);

      if (!d || !n) {
        setHasPrivateKey({ loading: false, value: false });
        return;
      }

      const result = await decryptString(
        await encryptString(
          "test",
          {
            e: session.user.publicKeyE,
            n: session.user.publicKeyN,
          },
          { async: false }
        ),
        {
          d,
          n,
        },
        { async: false }
      );

      setHasPrivateKey({ loading: false, value: result === "test" });
    } catch {
      setHasPrivateKey({ loading: false, value: false });
    }
  }, [isPending, session]);

  useEffect(() => {
    checkKeys();
  }, [checkKeys]);

  return (
    <PrivateKeyContext.Provider
      value={{
        ...hasPrivateKey,
        refetch: checkKeys,
      }}
    >
      {children}
    </PrivateKeyContext.Provider>
  );
}

export function useHasPrivateKey() {
  const context = useContext(PrivateKeyContext);
  if (!context) {
    throw new Error("useHasPrivateKey must be used within PrivateKeyProvider");
  }
  return context;
}
