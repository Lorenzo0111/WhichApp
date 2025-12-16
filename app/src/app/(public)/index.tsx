import { Button } from "@/components/ui/button";
import { ChatBackground } from "@/components/ui/chat-background";
import { Input } from "@/components/ui/input";
import { useKeyboard } from "@/hooks/keyboard";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import classNames from "classnames";
import { Link, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

export default function LoginScreen() {
  const router = useRouter();

  const keyboard = useKeyboard();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setIsLoading(true);

    try {
      // Tenta di accedere
      const { data, error } = await authClient.signIn.username({
        username: username,
        password: password,
      });

      if (error) throw error;

      if (data) {
        // Verifica se ci sono chiavi private salvate
        const hasPrivateKey =
          !!SecureStore.getItem(PRIVATE_KEY_D(data.user.id)) &&
          !!SecureStore.getItem(PRIVATE_KEY_N(data.user.id));

        // Se non ci sono chiavi private salvate, reindirizza alla schermata di no-keys
        if (!hasPrivateKey) router.push("/no-keys");
      }
    } catch (error: any) {
      // Se ci sono errori, mostra un avviso
      Alert.alert(
        "Errore",
        error.message ?? "Si è verificato un errore durante l'accesso"
      );
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-background justify-end relative">
      <ChatBackground />

      <View
        className={classNames(
          "bg-background w-full mt-auto flex flex-col items-center justify-center rounded-3xl z-10",
          keyboard ? "h-3/4 rounded-b-none justify-start pt-10" : "h-2/5"
        )}
      >
        <View className="flex flex-row gap-2">
          <Text className="text-text text-5xl pt-2 font-bold">👋</Text>

          <View className="flex flex-col items-start justify-center">
            <Text className="text-text text-xl font-bold">Bentornato!</Text>
            <Text className="text-input text-sm">
              Accedi per riprendere da dove hai lasciato
            </Text>
          </View>
        </View>

        <View className="w-full px-10 mt-6 flex flex-col gap-2">
          <Input
            placeholder="Nome Utente"
            keyboardType="default"
            autoCapitalize="none"
            autoComplete="username"
            returnKeyType="next"
            value={username}
            onChangeText={setUsername}
          />
          <Input
            placeholder="Password"
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            returnKeyType="done"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <Button loading={isLoading} onPress={handleLogin} label="Accedi" />
          <Text className="text-input text-center text-sm pt-2">
            Sei nuovo?{" "}
            <Link href="/register" className="text-primary">
              Registrati
            </Link>
          </Text>
        </View>
      </View>
    </View>
  );
}
