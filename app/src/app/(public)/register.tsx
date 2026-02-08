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
        // Generate private keys
        const { publicKey, privateKey } = await generateKeys();

        // Register the user
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
          // Save the private keys to the storage
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
        // If there are errors, show an alert
        Alert.alert(
          "Error",
          error.message ?? "An error occurred while registering",
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
          <Loading message="We are creating your account" />
        ) : (
          <>
            <View className="flex flex-row gap-2">
              <Text className="text-text text-5xl pt-2 font-bold">👋</Text>

              <View className="flex flex-col items-start justify-center">
                <Text className="text-text text-xl font-bold">Welcome!</Text>
                <Text className="text-input text-sm">
                  Start chatting with your friends and family
                </Text>
              </View>
            </View>
            <View className="w-full px-10 mt-6 flex flex-col gap-2">
              <Input
                placeholder="Name"
                keyboardType="default"
                autoCapitalize="words"
                autoComplete="name"
                returnKeyType="next"
                value={name}
                onChangeText={setName}
              />
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
                label="Register"
              />
              <Text className="text-input text-center text-sm pt-2">
                Already have an account?{" "}
                <Link href="/" className="text-primary">
                  Login
                </Link>
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}
