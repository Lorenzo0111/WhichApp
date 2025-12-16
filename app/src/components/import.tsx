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
import { Alert } from "react-native";
import { Button } from "./ui/button";

export type ImportButtonProps = {
  setLoading: (loading: boolean) => void;
  loading: boolean;
};

export function ImportButton({ setLoading, loading }: ImportButtonProps) {
  const router = useRouter();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { refetch: refetchKeys } = useHasPrivateKey();

  useEffect(() => {
    // Quando viene scansionato un codice QR, importa la chiave privata
    const subscription = CameraView.onModernBarcodeScanned(async (event) => {
      // Se l'utente non è autenticato, non importare la chiave privata
      if (!session?.user.id) return;

      // Se il codice QR non inizia con il prefisso della chiave privata, non importarla
      if (!event.data.startsWith(PRIVATE_KEY_PREFIX)) return;

      // Avvia il caricamento
      setLoading(true);

      // Chiude lo scanner
      await CameraView.dismissScanner();

      // Estrae la chiave privata dal codice QR
      const data = atob(event.data.slice(PRIVATE_KEY_PREFIX.length));

      // Effettua la verifica della chiave privata
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

      // Se la verifica fallisce, mostra un avviso
      if (result !== "test") {
        Alert.alert("Errore", "La chiave importata non è valida");
        setLoading(false);
        return;
      }

      // Salva la chiave privata nello storage
      SecureStore.setItem(PRIVATE_KEY_D(session.user.id), data);
      SecureStore.setItem(
        PRIVATE_KEY_N(session.user.id),
        session.user.publicKeyN
      );

      // Aggiorna la sessione e le chiavi private
      await refetchSession();
      await refetchKeys();

      // Reindirizza l'utente alla home
      setTimeout(() => {
        router.replace("/(private)/(tabs)");
        router.replace("/(private)/(tabs)");
      }, 100);

      // Termina il caricamento
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
