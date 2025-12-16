import * as schema from "@/db/schema";
import { useWebSocket } from "@/hooks/websocket";
import { authClient } from "@/lib/auth";
import { db } from "@/lib/db";
import client from "@/lib/fetcher";
import { Chat } from "@/lib/types";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { Image } from "expo-image";
import { Link } from "expo-router";
import { CheckIcon, TrashIcon } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

export function ChatItem({
  id,
  name,
  image,
  refetch,
}: Chat & { refetch: () => void }) {
  const { data: session } = authClient.useSession();
  const { subscribeToChat } = useWebSocket();

  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const swipeMethodsRef = useRef<SwipeableMethods | null>(null);

  useEffect(() => {
    // Ottiene l'ultimo messaggio della chat
    db.select({
      content: schema.message.content,
    })
      .from(schema.message)
      .where(eq(schema.message.chatId, id))
      .orderBy(desc(schema.message.timestamp))
      .limit(1)
      .then((res) => res && res[0] && setLastMessage(res[0].content ?? null));
  }, [id]);

  useEffect(() => {
    if (!session?.user.id) return;

    // Carica il numero di messaggi non letti
    const loadUnreadCount = async () => {
      const unreadMessages = await db
        .select({ id: schema.message.id })
        .from(schema.message)
        .where(
          and(
            eq(schema.message.chatId, id),
            ne(schema.message.sender, session.user.id),
            or(eq(schema.message.read, false), isNull(schema.message.read))
          )
        );

      setUnreadCount(unreadMessages.length);
    };

    loadUnreadCount();
  }, [id, session?.user.id]);

  useEffect(() => {
    // Sottoscrive al WebSocket per ricevere i nuovi messaggi
    const unsubscribe = subscribeToChat(id, (message) => {
      // Aggiorna l'ultimo messaggio
      setLastMessage(message.content);

      // Incrementa il numero di messaggi non letti
      if (message.sender !== session?.user.id)
        setUnreadCount((prev) => prev + 1);
    });

    // Quando il componente viene smontato, annulla la sottoscrizione
    return unsubscribe;
  }, [id, session?.user.id, subscribeToChat]);

  /**
   * @description Marca tutti i messaggi non letti come letti
   */
  const handleMarkAllAsRead = async () => {
    // Se l'utente non è autenticato, non marcare i messaggi come letti
    if (!session?.user.id) return;

    // Marca tutti i messaggi non letti come letti
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

    setUnreadCount(0);
    swipeMethodsRef.current?.close();
  };

  /**
   * @description Lascia la chat
   */
  const handleLeaveChat = async () => {
    // Elimina i messaggi della chat
    await db.delete(schema.message).where(eq(schema.message.chatId, id));

    // Elimina la chat
    await client.chats({ id: id }).delete();

    // Chiude lo swipeable
    swipeMethodsRef.current?.close();

    // Aggiorna la lista delle chat
    refetch();
  };

  return (
    <Swipeable
      ref={swipeMethodsRef}
      leftThreshold={64}
      rightThreshold={64}
      overshootRight={false}
      overshootLeft={false}
      renderLeftActions={() => (
        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          className="flex-1 justify-center items-start pl-4"
        >
          <View className="bg-green-600 size-9 flex items-center justify-center rounded-full">
            <CheckIcon color="white" size={20} />
          </View>
        </TouchableOpacity>
      )}
      renderRightActions={() => (
        <TouchableOpacity
          onPress={handleLeaveChat}
          className="flex-1 justify-center items-end pr-4"
        >
          <View className="bg-red-600 size-9 flex items-center justify-center rounded-full">
            <TrashIcon color="white" size={20} />
          </View>
        </TouchableOpacity>
      )}
    >
      <Link
        href={`/chats/${id}`}
        className="flex-1 flex flex-row p-4 pr-0 rounded-lg items-center justify-between w-full border-b border-card"
        asChild
      >
        <Pressable className="flex flex-row items-center justify-between w-full">
          <View className="flex flex-row items-center gap-2">
            <View className="w-12 h-10 rounded-full">
              <Image
                source={{
                  uri:
                    image ??
                    "https://placehold.co/40?text=" + (name?.charAt(0) ?? "U"),
                }}
                style={{ width: 40, height: 40, borderRadius: 100 }}
              />
            </View>

            <View>
              <Text className="text-text text-xl">{name}</Text>
              <Text className="text-input text-sm line-clamp-1">
                {lastMessage
                  ? lastMessage.length > 40
                    ? lastMessage.substring(0, 40) + "..."
                    : lastMessage
                  : "Ancora nessun messaggio"}
              </Text>
            </View>
          </View>

          {unreadCount > 0 && (
            <View className="bg-red-600 size-6 ml-auto mr-6 rounded-full items-center justify-center">
              <Text className="text-white text-xs font-bold text-center">
                {unreadCount}
              </Text>
            </View>
          )}
        </Pressable>
      </Link>
    </Swipeable>
  );
}
