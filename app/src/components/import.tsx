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
    // When a QR code is scanned, import the private key
    const subscription = CameraView.onModernBarcodeScanned(async (event) => {
      // If the user is not authenticated, do not import the private key
      if (!session?.user.id) return;

      // If the QR code does not start with the private key prefix, do not import it
      if (!event.data.startsWith(PRIVATE_KEY_PREFIX)) return;

      // Start the loading
      setLoading(true);

      // Close the scanner
      await CameraView.dismissScanner();

      // Extract the private key from the QR code
      const data = atob(event.data.slice(PRIVATE_KEY_PREFIX.length));

      // Verify the private key
      const result = await decryptString(
        await encryptString(
          "test",
          {
            e: session.user.publicKeyE,
            n: session.user.publicKeyN,
          },
          { async: false },
        ),
        {
          d: data,
          n: session.user.publicKeyN,
        },
        { async: false },
      );

      // If the verification fails, show an alert
      if (result !== "test") {
        Alert.alert("Error", "The imported key is not valid");
        setLoading(false);
        return;
      }

      // Save the private key to the storage
      SecureStore.setItem(PRIVATE_KEY_D(session.user.id), data);
      SecureStore.setItem(
        PRIVATE_KEY_N(session.user.id),
        session.user.publicKeyN,
      );

      // Update the session and the private keys
      await refetchSession();
      await refetchKeys();

      // Redirect the user to the home
      setTimeout(() => {
        router.replace("/(private)/(tabs)");
        router.replace("/(private)/(tabs)");
      }, 100);

      // Finish loading
      setLoading(false);
    });

    return () => subscription.remove();
  }, [session]);

  return (
    <Button
      className="flex-1"
      label="Import"
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
