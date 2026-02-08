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

    // Regenerate the private keys
    requestIdleCallback(async () => {
      // Wait 100ms to avoid blocking the main thread
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        // Try to regenerate the private keys
        const { publicKey, privateKey } = await generateKeys();

        // Update the private keys in the database
        const { data, error } = await authClient.updateUser({
          publicKeyE: publicKey.e,
          publicKeyN: publicKey.n,
        });

        if (error) throw error;

        if (data) {
          // Save the private keys to the storage
          SecureStore.setItem(
            PRIVATE_KEY_D(session?.user.id),
            privateKey.d.toString(),
          );
          SecureStore.setItem(
            PRIVATE_KEY_N(session?.user.id),
            privateKey.n.toString(),
          );

          // Update the session and the private keys
          await refetchSession();
          await refetchKeys();

          // Redirect the user to the home
          setTimeout(() => {
            router.replace("/(private)/(tabs)");
            router.replace("/(private)/(tabs)");
          }, 100);
        }
      } catch (error) {
        // If there are errors, show an alert
        Alert.alert("Error", "An error occurred while regenerating the keys");
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
            <Loading message="Regenerating the keys" />
          ) : (
            <>
              <Text className="text-text text-5xl pt-2 font-bold">
                <LockIcon
                  color={(primaryColor as string) ?? "#fff"}
                  size={50}
                />
              </Text>
              <Text className="mt-2 text-text text-center text-xl font-bold">
                Error!
              </Text>
              <Text className="text-input text-center text-sm max-w-3/4">
                There are no private keys saved for this user. Regenerate new
                keys or import an existing one to continue.
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
                    label="Regenerate"
                    onPress={handleRegenerateKeys}
                    loading={isLoading}
                  />
                </View>
                <Button
                  variant="outline"
                  label="Cancel"
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
