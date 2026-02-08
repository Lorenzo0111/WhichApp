import "@/global.css";
import { PrivateKeyProvider, useHasPrivateKey } from "@/hooks/secrets";
import { authClient } from "@/lib/auth";
import { db } from "@/lib/db";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Alert } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import migrations from "../../drizzle/migrations";

function LayoutContent() {
  const { success, error } = useMigrations(db, migrations);

  const { isPending, data: session } = authClient.useSession();
  const hasPrivateKey = useHasPrivateKey();

  useEffect(() => {
    if (!success && error) {
      Alert.alert("Error", "An error occurred while migrating the database");
      console.error(error);
    }
  }, [success, error]);

  return (
    <GestureHandlerRootView>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={isPending || hasPrivateKey.loading || !success}>
          <Stack.Screen name="(loading)" />
        </Stack.Protected>

        <Stack.Protected
          guard={!isPending && !hasPrivateKey.loading && !session}
        >
          <Stack.Screen name="(public)" />
        </Stack.Protected>

        <Stack.Protected
          guard={
            !isPending &&
            !!session &&
            !hasPrivateKey.loading &&
            hasPrivateKey.value
          }
        >
          <Stack.Screen name="(private)" />
        </Stack.Protected>
      </Stack>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  return (
    <PrivateKeyProvider>
      <LayoutContent />
    </PrivateKeyProvider>
  );
}
