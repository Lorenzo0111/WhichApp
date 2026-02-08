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
      // Try to login
      const { data, error } = await authClient.signIn.username({
        username: username,
        password: password,
      });

      if (error) throw error;

      if (data) {
        // Check if there are private keys saved
        const hasPrivateKey =
          !!SecureStore.getItem(PRIVATE_KEY_D(data.user.id)) &&
          !!SecureStore.getItem(PRIVATE_KEY_N(data.user.id));

        // If there are no private keys saved, redirect to the no-keys screen
        if (!hasPrivateKey) router.push("/no-keys");
      }
    } catch (error: any) {
      // If there are errors, show an alert
      Alert.alert(
        "Error",
        error.message ?? "An error occurred while logging in",
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
          keyboard ? "h-3/4 rounded-b-none justify-start pt-10" : "h-2/5",
        )}
      >
        <View className="flex flex-row gap-2">
          <Text className="text-text text-5xl pt-2 font-bold">👋</Text>

          <View className="flex flex-col items-start justify-center">
            <Text className="text-text text-xl font-bold">Welcome back!</Text>
            <Text className="text-input text-sm">
              Login to continue where you left off
            </Text>
          </View>
        </View>

        <View className="w-full px-10 mt-6 flex flex-col gap-2">
          <Input
            placeholder="Username"
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

          <Button loading={isLoading} onPress={handleLogin} label="Login" />
          <Text className="text-input text-center text-sm pt-2">
            Are you new?{" "}
            <Link href="/register" className="text-primary">
              Register
            </Link>
          </Text>
        </View>
      </View>
    </View>
  );
}
