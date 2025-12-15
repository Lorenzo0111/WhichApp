import { useHasPrivateKey } from "@/hooks/secrets";
import { authClient } from "@/lib/auth";
import {
  PRIVATE_KEY_D,
  PRIVATE_KEY_N,
  PRIVATE_KEY_PREFIX,
} from "@/lib/constants";
import { decryptString, encryptString } from "@/lib/crypto";
import { CameraView } from "expo-camera";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect } from "react";
import { Button } from "./ui/button";
import { Alert } from "react-native";

export type ImportButtonProps = {
  setLoading: (loading: boolean) => void;
  loading: boolean;
};

export function ImportButton({ setLoading, loading }: ImportButtonProps) {
  const router = useRouter();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { refetch: refetchKeys } = useHasPrivateKey();

  useEffect(() => {
    const subscription = CameraView.onModernBarcodeScanned(async (event) => {
      if (!session?.user.id) return;
      if (!event.data.startsWith(PRIVATE_KEY_PREFIX)) return;

      setLoading(true);

      await CameraView.dismissScanner();

      const data = atob(event.data.slice(PRIVATE_KEY_PREFIX.length));

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
          d: data,
          n: session.user.publicKeyN,
        },
        { async: false }
      );

      if (result !== "test") {
        Alert.alert("Errore", "La chiave importata non è valida");
        setLoading(false);
        return;
      }

      SecureStore.setItem(PRIVATE_KEY_D(session.user.id), data);
      SecureStore.setItem(
        PRIVATE_KEY_N(session.user.id),
        session.user.publicKeyN
      );

      await refetchSession();
      await refetchKeys();
      setTimeout(() => {
        router.replace("/(private)/(tabs)");
        router.replace("/(private)/(tabs)");
      }, 100);

      setLoading(false);
    });

    return () => subscription.remove();
  }, [session]);

  return (
    <Button
      className="flex-1"
      label="Importa"
      onPress={() =>
        CameraView.launchScanner({
          barcodeTypes: ["qr"],
          isGuidanceEnabled: false,
          isHighlightingEnabled: true,
        })
      }
      loading={loading}
    />
  );
}
