import BaseLayout from "@/components/base-layout";
import { ImportButton } from "@/components/import";
import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { ChatBackground } from "@/components/ui/chat-background";
import { useHasPrivateKey } from "@/hooks/secrets";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { generateKeys } from "@/lib/crypto";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { LockIcon } from "lucide-react-native";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { useCSSVariable } from "uniwind";

export default function NoKeysScreen() {
  const router = useRouter();
  const primaryColor = useCSSVariable("--color-primary");

  const { data: session, refetch: refetchSession } = authClient.useSession();
  const { refetch: refetchKeys } = useHasPrivateKey();
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  async function handleRegenerateKeys() {
    setIsLoading(true);

    requestIdleCallback(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        const { publicKey, privateKey } = await generateKeys();

        const { data, error } = await authClient.updateUser({
          publicKeyE: publicKey.e,
          publicKeyN: publicKey.n,
        });

        if (error) throw error;

        if (data) {
          SecureStore.setItem(
            PRIVATE_KEY_D(session?.user.id),
            privateKey.d.toString()
          );
          SecureStore.setItem(
            PRIVATE_KEY_N(session?.user.id),
            privateKey.n.toString()
          );
          await refetchSession();
          await refetchKeys();
          setTimeout(() => {
            router.replace("/(private)/(tabs)");
            router.replace("/(private)/(tabs)");
          }, 100);
        }
      } catch (error) {
        Alert.alert(
          "Errore",
          "Si è verificato un errore durante la rigenerazione delle chiavi"
        );
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    });
  }

  return (
    <BaseLayout>
      <View className="flex-1 bg-background justify-end relative">
        <ChatBackground />

        <View className="bg-background w-full h-2/5 mt-auto flex flex-col items-center justify-center rounded-3xl z-10">
          {isLoading ? (
            <Loading message="Rigenerazione delle chiavi" />
          ) : (
            <>
              <Text className="text-text text-5xl pt-2 font-bold">
                <LockIcon
                  color={(primaryColor as string) ?? "#fff"}
                  size={50}
                />
              </Text>
              <Text className="mt-2 text-text text-center text-xl font-bold">
                Errore!
              </Text>
              <Text className="text-input text-center text-sm max-w-3/4">
                Non ci sono chiavi private salvate per questo utente. Rigenera
                delle nuove chiavi o importane una esistente per continuare.
              </Text>
              <View className="flex flex-col gap-4 mt-4 w-3/4">
                <View className="flex flex-row gap-4 w-full">
                  <ImportButton
                    setLoading={setIsImporting}
                    loading={isImporting}
                  />
                  <Button
                    variant="destructive"
                    className="flex-1"
                    label="Rigenera"
                    onPress={handleRegenerateKeys}
                    loading={isLoading}
                  />
                </View>
                <Button
                  variant="outline"
                  label="Annulla"
                  disabled={isLoading}
                  onPress={async () => {
                    await authClient.signOut();
                    router.replace("/");
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </BaseLayout>
  );
}
