import { Loading } from "@/components/loading";
import { Button } from "@/components/ui/button";
import { ChatBackground } from "@/components/ui/chat-background";
import { Input } from "@/components/ui/input";
import { useKeyboard } from "@/hooks/keyboard";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { generateKeys } from "@/lib/crypto";
import classNames from "classnames";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Alert, Text, View } from "react-native";

export default function RegisterScreen() {
  const keyboard = useKeyboard();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    setIsLoading(true);

    requestIdleCallback(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));

      try {
        // Genera le chiavi private
        const { publicKey, privateKey } = await generateKeys();

        // Registra l'utente
        const { data, error } = await authClient.signUp.email({
          email: email,
          name: name,
          password: password,
          username: username,
          displayUsername: username,
          publicKeyE: publicKey.e,
          publicKeyN: publicKey.n,
        });

        if (error) throw error;

        if (data) {
          // Salva le chiavi private nello storage
          SecureStore.setItem(
            PRIVATE_KEY_D(data.user.id),
            privateKey.d.toString()
          );
          SecureStore.setItem(
            PRIVATE_KEY_N(data.user.id),
            privateKey.n.toString()
          );
        }
      } catch (error: any) {
        // Se ci sono errori, mostra un avviso
        Alert.alert(
          "Errore",
          error.message ?? "Si è verificato un errore durante la registrazione"
        );
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    });
  }

  return (
    <View className="flex-1 bg-background justify-end relative">
      <ChatBackground />

      <View
        className={classNames(
          "bg-background w-full mt-auto flex flex-col items-center justify-center rounded-3xl z-10",
          keyboard ? "h-5/6 rounded-b-none justify-start pt-10" : "h-1/2"
        )}
      >
        {isLoading ? (
          <Loading message="Stiamo creando il tuo account" />
        ) : (
          <>
            <View className="flex flex-row gap-2">
              <Text className="text-text text-5xl pt-2 font-bold">👋</Text>

              <View className="flex flex-col items-start justify-center">
                <Text className="text-text text-xl font-bold">Benvenuto!</Text>
                <Text className="text-input text-sm">
                  Inizia a chattare con i tuoi amici e familiari
                </Text>
              </View>
            </View>
            <View className="w-full px-10 mt-6 flex flex-col gap-2">
              <Input
                placeholder="Nome"
                keyboardType="default"
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                value={name}
                onChangeText={setName}
              />
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
                placeholder="Email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                value={email}
                onChangeText={setEmail}
              />
              <Input
                placeholder="Password"
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                returnKeyType="next"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <Button
                loading={isLoading}
                onPress={handleRegister}
                label="Registrati"
              />
              <Text className="text-input text-center text-sm pt-2">
                Hai già un account?{" "}
                <Link href="/" className="text-primary">
                  Accedi
                </Link>
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
