import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth";
import { API_BASE_URL, PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Link } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { LogOutIcon, UserIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Alert,
  ColorValue,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

type SelectedImage = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
};

export default function ProfileScreen() {
  const { data: session } = authClient.useSession();
  const textColor = useCSSVariable("--color-text");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (session) {
      // Load the profile data
      setName(session.user.name);
      setUsername(session.user.username ?? "");
      setEmail(session.user.email);
      setImagePreview(session.user.image ?? null);
      setSelectedImage(null);
    }
  }, [session]);

  if (!session) return null;

  async function handlePickImage() {
    // Open the image library
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    // If the user has canceled the selection, do nothing
    if (result.canceled) return;

    const asset = result.assets[0];

    // Set the selected image
    setSelectedImage({
      uri: asset.uri,
      mimeType: asset.mimeType,
      fileName: asset.fileName,
    });

    // Set the image preview
    setImagePreview(asset.uri);
  }

  /**
   * @description Save the profile changes
   */
  async function handleSaveChanges() {
    if (isSaving) return;

    setIsSaving(true);

    try {
      let finalImage = imagePreview;

      if (selectedImage) {
        // Create a FormData for the image upload
        const formData = new FormData();

        formData.append("file", {
          uri: selectedImage.uri,
          name: selectedImage.fileName || "image.jpg",
          type: selectedImage.mimeType || "image/jpeg",
        } as any);

        // Upload the image to the server
        const response = await fetch(`${API_BASE_URL}/uploads/profile`, {
          method: "POST",
          headers: {
            Cookie: authClient.getCookie(),
          },
          body: formData,
        });

        // If the upload fails, throw an error
        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Upload failed" }));
          throw new Error(errorData.error || "Upload failed");
        }

        // Get the upload data
        const data = await response.json();

        // Set the image preview
        finalImage = data.url ?? null;

        // Clear the selected image
        setSelectedImage(null);
      }

      // Update the profile data
      const { error } = await authClient.updateUser({
        name: name,
        username: username,
        image: finalImage ?? undefined,
      });

      if (error) throw error;

      // Set the image preview
      setImagePreview(finalImage ?? null);

      // Show a success alert
      Alert.alert("Success", "Profile updated successfully");
    } catch (error) {
      // If there are errors, show an alert
      Alert.alert("Error", "An error occurred while saving the changes");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Header>
        <Text className="text-text text-2xl font-bold flex justify-center items-center gap-2">
          <UserIcon color={(textColor as ColorValue) ?? "white"} size={20} />{" "}
          Profile
        </Text>

        <TouchableOpacity
          onPress={async () => {
            await authClient.signOut();
          }}
        >
          <LogOutIcon color={(textColor as ColorValue) ?? "white"} size={20} />
        </TouchableOpacity>
      </Header>

      <Pressable
        onPress={handlePickImage}
        className="size-42 rounded-full mx-auto py-4"
      >
        <Image
          source={{
            uri:
              imagePreview ??
              `https://placehold.co/100?text=${(name || "U").charAt(0)}`,
          }}
          style={{ width: 130, height: 130, borderRadius: 60 }}
        />
      </Pressable>

      <View className="gap-4 px-4 flex flex-col mt-4">
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
          editable={false}
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

        <View className="flex flex-row gap-4">
          <Button
            className="flex-1"
            label="Save"
            onPress={handleSaveChanges}
            disabled={isSaving}
          />
        </View>

        <View className="flex flex-row gap-4 w-full">
          <Link href="/export" asChild>
            <Button
              className="flex-1"
              variant="outline"
              label="Export Keys"
              onPress={async () => {}}
            />
          </Link>
          <Button
            className="flex-1"
            variant="destructive"
            label="Delete Keys"
            onPress={async () => {
              await SecureStore.deleteItemAsync(PRIVATE_KEY_D(session.user.id));
              await SecureStore.deleteItemAsync(PRIVATE_KEY_N(session.user.id));
              await authClient.signOut();
            }}
          />
        </View>
      </View>
    </View>
  );
}
