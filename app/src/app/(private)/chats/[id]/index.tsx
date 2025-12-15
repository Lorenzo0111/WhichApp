import { MessageItem } from "@/components/chat/message";
import { Header } from "@/components/header";
import * as schema from "@/db/schema";
import { useWebSocket } from "@/hooks/websocket";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { decryptString } from "@/lib/crypto";
import { db } from "@/lib/db";
import client from "@/lib/fetcher";
import { FullChat, Message } from "@/lib/types";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { Image } from "expo-image";
import {
  Redirect,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeftIcon, PaperclipIcon, SendIcon } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ColorValue,
  FlatList,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const { connected, sendMessage, subscribeToChat, subscribeToUser } =
    useWebSocket();

  const textColor = useCSSVariable("--color-text");
  const inputColor = useCSSVariable("--color-input");

  const [online, setOnline] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [chat, setChat] = useState<FullChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const isFocusedRef = useRef(false);

  const markMessageAsRead = useCallback(async (messageId: string) => {
    await db
      .update(schema.message)
      .set({ read: true })
      .where(eq(schema.message.id, messageId));

    setMessages((prev) =>
      prev.map((item) =>
        item.id === messageId ? { ...item, read: true } : item
      )
    );
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!id || !session?.user.id) return;

    await db
      .update(schema.message)
      .set({ read: true })
      .where(
        and(
          eq(schema.message.chatId, id),
          ne(schema.message.sender, session.user.id),
          or(eq(schema.message.read, false), isNull(schema.message.read))
        )
      );

    setMessages((prev) =>
      prev.map((item) =>
        item.chatId === id && item.sender !== session.user.id
          ? { ...item, read: true }
          : item
      )
    );
  }, [id, session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      markAllAsRead();

      return () => {
        isFocusedRef.current = false;
      };
    }, [markAllAsRead])
  );

  useEffect(() => {
    if (!id || !loading) return;

    client
      .chats({ id })
      .get()
      .then(async (res) => {
        setChat(res.data ?? null);

        const [privateKeyD, privateKeyN] = await Promise.all([
          SecureStore.getItemAsync(PRIVATE_KEY_D(session?.user.id), {
            requireAuthentication: true,
          }),
          SecureStore.getItemAsync(PRIVATE_KEY_N(session?.user.id), {
            requireAuthentication: true,
          }),
        ]);

        if (!privateKeyD || !privateKeyN) return;

        res.data?.members
          .filter((member) => member.id !== session?.user.id)
          .forEach(async (member) => {
            const isOnline = await client.users({ id: member.id }).online.get();
            if (isOnline.data ?? false)
              setOnline((prev) =>
                prev.includes(member.id) ? prev : [...prev, member.id]
              );
          });

        await db
          .select()
          .from(schema.message)
          .where(eq(schema.message.chatId, id))
          .orderBy(desc(schema.message.timestamp))
          .then((res) =>
            setMessages(
              res.map((item) => ({
                ...item,
                self: item.sender === session?.user.id,
              }))
            )
          );

        await client
          .chats({ id })
          .messages.get()
          .then(async (res) => {
            for (const newMessage of res.data ?? []) {
              if (messages.find((message) => message.id === newMessage.id))
                continue;

              const decryptedMessage = await decryptString(
                newMessage.encryptedContent,
                {
                  d: privateKeyD,
                  n: privateKeyN,
                }
              );

              const newItem = {
                id: newMessage.id,
                content: decryptedMessage,
                sender: newMessage.sender,
                timestamp: new Date(newMessage.createdAt),
                chatId: id,
                self: newMessage.sender === session?.user.id,
                read: newMessage.sender === session?.user.id,
              } as Message;

              try {
                await db.insert(schema.message).values(newItem).execute();

                setMessages((prev) =>
                  [...prev, newItem].sort(
                    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
                  )
                );
              } catch {}
            }
          });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, session?.user.id]);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToChat(id, (newMessage) => {
      setMessages((prev) => {
        if (prev.find((m) => m.id === newMessage.id)) return prev;

        return [newMessage, ...prev];
      });

      if (
        isFocusedRef.current &&
        newMessage.sender !== session?.user.id &&
        !newMessage.read
      ) {
        markMessageAsRead(newMessage.id);
      }
    });

    return unsubscribe;
  }, [id, markMessageAsRead, session?.user.id, subscribeToChat]);

  useEffect(() => {
    let unsubscribes: (() => void)[] = [];

    for (const member of chat?.members ?? []) {
      unsubscribes.push(
        subscribeToUser(member.id, (connection) => {
          setOnline((prev) =>
            connection.online
              ? prev.includes(connection.user)
                ? prev
                : [...prev, connection.user]
              : prev.filter((user) => user !== connection.user)
          );
        })
      );
    }

    return () => {
      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }
    };
  }, [chat?.members, subscribeToUser]);

  const handleSendMessage = async () => {
    if (!connected || !message || message.trim() === "" || !chat || !id) return;

    sendMessage(id, message, chat.members);
    setMessage("");
  };

  if (!loading && !chat) return <Redirect href="/" />;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 bg-background flex flex-col"
    >
      <Header>
        <View className="flex flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-text text-2xl">
              <ArrowLeftIcon
                color={(textColor as ColorValue) ?? "white"}
                size={20}
              />
            </Text>
          </TouchableOpacity>
          {chat && (
            <TouchableOpacity
              onPress={() => router.push(`/chats/${id}/settings`)}
              className="flex flex-row items-center gap-2"
            >
              <Image
                source={{
                  uri:
                    chat.image ??
                    "https://placehold.co/40?text=" + chat.name.charAt(0),
                }}
                style={{ width: 30, height: 30, borderRadius: 100 }}
              />

              <View className="flex flex-col gap-0.5">
                <Text className="text-text text-2xl font-bold">
                  {chat.name}
                </Text>
                <View className="flex flex-row items-center gap-1">
                  <View
                    className="size-2 rounded-full"
                    style={{
                      backgroundColor: online.length > 0 ? "lime" : "red",
                    }}
                  />
                  <Text className="text-sm text-text">
                    {chat.members.length > 2
                      ? `${online.length} online`
                      : online.length > 0
                      ? "Online"
                      : "Offline"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </Header>

      <FlatList
        data={messages}
        renderItem={({ item }) => (
          <MessageItem
            {...item}
            senderObject={
              chat?.members.find((member) => member.id === item.sender) ?? null
            }
          />
        )}
        ItemSeparatorComponent={() => <View className="h-4" />}
        keyExtractor={(item) => item.id}
        inverted
        className="h-full mx-4 mb-4"
      />

      <View className="bg-card flex flex-row items-center gap-2 w-full pt-2 pb-4 px-6">
        <TouchableOpacity onPress={() => {}}>
          <PaperclipIcon
            color={(textColor as ColorValue) ?? "white"}
            size={20}
          />
        </TouchableOpacity>

        <TextInput
          placeholder="Scrivi un messaggio"
          className="text-text w-full flex-1"
          multiline
          placeholderTextColor={inputColor as ColorValue}
          submitBehavior="submit"
          onSubmitEditing={handleSendMessage}
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity
          className="size-9 pr-0.5 flex items-center justify-center rounded-full bg-linear-to-r from-primary to-secondary disabled:opacity-50"
          onPress={handleSendMessage}
          disabled={!connected || !message || message.trim() === ""}
        >
          <SendIcon color={(textColor as ColorValue) ?? "white"} size={17} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
