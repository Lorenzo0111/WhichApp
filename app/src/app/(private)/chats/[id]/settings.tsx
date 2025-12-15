import { Header } from "@/components/header";
import { UserItem } from "@/components/home/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as schema from "@/db/schema";
import { db } from "@/lib/db";
import client from "@/lib/fetcher";
import { User } from "@/lib/types";
import { eq } from "drizzle-orm";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeftIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ColorValue,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

export default function ChatSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const textColor = useCSSVariable("--color-text");
  const inputColor = useCSSVariable("--color-input");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingMessages, setDeletingMessages] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatImage, setChatImage] = useState("");
  const [members, setMembers] = useState<User[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    if (!id) return;

    client
      .chats({ id })
      .get()
      .then((res) => {
        if (res.data) {
          setChatName(res.data.name);
          setChatImage(res.data.image ?? "");
          setMembers(res.data.members);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!searchQuery || searchQuery.trim() === "") {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      setSearching(true);
      client.users.search
        .get({ query: { query: searchQuery } })
        .then((res) => {
          const memberIds = new Set(members.map((m) => m.id));
          setSearchResults(
            (res.data ?? []).filter((user) => !memberIds.has(user.id))
          );
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, members]);

  const handleSave = async () => {
    if (!id || saving) return;

    setSaving(true);
    try {
      await client.chats({ id }).patch({
        name: chatName || undefined,
        image: chatImage || null,
      });
      router.back();
    } catch (error) {
      console.error("Failed to update chat:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!id || addingMember) return;

    setAddingMember(true);
    try {
      await client.chats({ id }).members.post({ userIds: [userId] });

      const res = await client.chats({ id }).get();
      if (res.data) {
        setMembers(res.data.members);
      }

      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      console.error("Failed to add member:", error);
    } finally {
      setAddingMember(false);
    }
  };

  const handleDeleteMessages = async () => {
    if (!id || deletingMessages) return;

    setDeletingMessages(true);
    try {
      await db.delete(schema.message).where(eq(schema.message.chatId, id));
    } catch (error) {
      console.error("Failed to delete messages:", error);
    } finally {
      setDeletingMessages(false);
    }
  };

  const handleLeaveChat = async () => {
    if (!id || leaving) return;

    setLeaving(true);
    try {
      await client.chats({ id }).delete();
      await db.delete(schema.message).where(eq(schema.message.chatId, id));
      router.replace("/(private)/(tabs)");
    } catch (error) {
      console.error("Failed to leave chat:", error);
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Header>
          <Text className="text-text text-2xl font-bold">Loading...</Text>
        </Header>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={textColor as ColorValue} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Header>
        <View className="flex flex-row items-center justify-between w-full">
          <View className="flex flex-row items-center gap-2">
            <TouchableOpacity onPress={() => router.back()}>
              <ArrowLeftIcon
                color={(textColor as ColorValue) ?? "white"}
                size={20}
              />
            </TouchableOpacity>
            <Text className="text-text text-2xl font-bold">Group Settings</Text>
          </View>

          <TouchableOpacity onPress={handleSave} disabled={saving}>
            <SaveIcon color={(textColor as ColorValue) ?? "white"} size={20} />
          </TouchableOpacity>
        </View>
      </Header>

      <View className="flex-1 px-4 py-6">
        <View className="mb-6 items-center">
          <Image
            source={{
              uri:
                chatImage ||
                `https://placehold.co/100?text=${chatName.charAt(0)}`,
            }}
            style={{ width: 100, height: 100, borderRadius: 50 }}
          />
        </View>

        <View className="mb-4">
          <Text className="text-text text-sm font-semibold mb-2">
            Group Name
          </Text>
          <Input
            value={chatName}
            onChangeText={setChatName}
            placeholder="Enter group name"
            placeholderTextColor={inputColor as ColorValue}
            className="text-text"
          />
        </View>

        <View className="mb-4">
          <Text className="text-text text-lg font-bold mb-3">
            Members ({members.length})
          </Text>
          <FlatList
            data={members}
            renderItem={({ item }) => (
              <UserItem {...item} onPress={() => {}} disabled />
            )}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            removeClippedSubviews={true}
          />
        </View>

        <View className="mb-4">
          <Text className="text-text text-lg font-bold mb-3">Add Members</Text>
          <View className="relative">
            <View className="flex flex-row items-center gap-2 border border-border rounded-lg px-3 py-2">
              <SearchIcon
                color={(textColor as ColorValue) ?? "white"}
                size={18}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search users..."
                placeholderTextColor={inputColor as ColorValue}
                className="text-text flex-1"
              />
              {searching && (
                <ActivityIndicator
                  size="small"
                  color={textColor as ColorValue}
                />
              )}
            </View>

            {searchResults.length > 0 && (
              <View className="mt-2 border border-border rounded-lg bg-card">
                <FlatList
                  data={searchResults}
                  renderItem={({ item: user }) => (
                    <UserItem
                      {...user}
                      onPress={() => handleAddMember(user.id)}
                      disabled={addingMember}
                      rightElement={
                        addingMember ? (
                          <ActivityIndicator
                            size="small"
                            color={textColor as ColorValue}
                          />
                        ) : (
                          <PlusIcon
                            color={(textColor as ColorValue) ?? "white"}
                            size={20}
                          />
                        )
                      }
                    />
                  )}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  removeClippedSubviews={true}
                />
              </View>
            )}
          </View>
        </View>

        <View className="mt-8 flex gap-3">
          <Button
            variant="outline"
            label="Delete all messages"
            loading={deletingMessages}
            onPress={handleDeleteMessages}
          />
          <Button
            variant="destructive"
            label="Leave chat"
            loading={leaving}
            onPress={handleLeaveChat}
          />
        </View>
      </View>
    </View>
  );
}
