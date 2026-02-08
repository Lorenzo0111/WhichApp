import client from "@/lib/fetcher";
import { User } from "@/lib/types";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { memo, ReactNode } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";

interface UserItemProps extends User {
  onPress?: () => void | Promise<void>;
  rightElement?: ReactNode;
  disabled?: boolean;
}

export const UserItem = memo(function UserItem({
  id,
  name,
  username,
  image,
  onPress,
  rightElement,
  disabled,
}: UserItemProps) {
  const router = useRouter();

  const defaultOnPress = async () => {
    const chat = await client.chats.post({
      members: [id],
    });

    if (chat.data) {
      router.replace(`/chats/${chat.data}`);
      return;
    }

    Alert.alert(
      "Error",
      "An error occurred while creating the chat",
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress ?? defaultOnPress}
      disabled={disabled}
      className="flex flex-row p-4 rounded-lg w-full border-b border-card items-center"
    >
      <View className="w-10 h-10 rounded-full mr-3">
        <Image
          source={{
            uri: image ?? "https://placehold.co/40?text=" + name.charAt(0),
          }}
          style={{ width: 40, height: 40, borderRadius: 100 }}
        />
      </View>

      <View className="flex-1">
        <Text className="text-text text-xl">{name}</Text>
        <Text className="text-input text-sm">@{username}</Text>
      </View>

      {rightElement && <View className="ml-2">{rightElement}</View>}
    </TouchableOpacity>
  );
});
