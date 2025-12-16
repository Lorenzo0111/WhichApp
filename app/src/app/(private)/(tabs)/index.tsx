import { Header } from "@/components/header";
import { ChatItem } from "@/components/home/chat";
import { useWebSocket } from "@/hooks/websocket";
import client from "@/lib/fetcher";
import { Chat } from "@/lib/types";
import { Link } from "expo-router";
import { MessageCircleIcon, PlusIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ColorValue,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

export default function ChatsScreen() {
  const textColor = useCSSVariable("--color-text");
  const { subscribeToAll, subscribeToRefetch } = useWebSocket();

  const [refreshing, setRefreshing] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const refresh = async () => {
    const res = await client.chats.get();

    setChats(res.data ?? []);
  };

  useEffect(() => {
    if (!refreshing) return;

    refresh();
  }, [refreshing]);

  useEffect(() => {
    const unsubscribe = subscribeToAll(async (message) => {
      const chat = chats.find((c) => c.id === message.chatId);
      if (!chat) await refresh();
    });

    return unsubscribe;
  }, [chats, subscribeToAll]);

  useEffect(() => {
    const unsubscribe = subscribeToRefetch(refresh);

    return unsubscribe;
  }, [subscribeToRefetch]);

  return (
    <View className="flex-1 bg-background">
      <Header>
        <Text className="text-text text-2xl font-bold flex justify-center items-center gap-2">
          <MessageCircleIcon
            color={(textColor as ColorValue) ?? "white"}
            size={20}
          />{" "}
          Chats
        </Text>

        <Link href="/chats/new" asChild>
          <TouchableOpacity>
            <PlusIcon color={(textColor as ColorValue) ?? "white"} size={20} />
          </TouchableOpacity>
        </Link>
      </Header>

      <FlatList
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        data={chats}
        renderItem={({ item }) => <ChatItem {...item} refetch={refresh} />}
        keyExtractor={(item) => item.id}
        className="h-full"
      />
    </View>
  );
}
