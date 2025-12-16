import * as schema from "@/db/schema";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_N } from "@/lib/constants";
import { decryptString, encryptString } from "@/lib/crypto";
import { db } from "@/lib/db";
import client from "@/lib/fetcher";
import { Message, WebSocketConnection } from "@/lib/types";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type WebSocketMessage =
  | {
      type: "message";
      id: string;
      content: string;
      sender: string;
      timestamp: number;
      chatId: string;
    }
  | {
      type: "connection";
      user: string;
      online: boolean;
    }
  | {
      type: "refetch";
    };

interface WebSocketReceiver {
  id: string;
  publicKeyE: string;
  publicKeyN: string;
}

interface WebSocketContextType {
  connected: boolean;
  sendMessage: (
    chatId: string,
    content: string,
    receivers: Array<WebSocketReceiver>
  ) => Promise<void>;
  subscribeToChat: (
    chatId: string,
    callback: (message: Message) => void
  ) => () => void;
  subscribeToUser: (
    userId: string,
    callback: (connection: { user: string; online: boolean }) => void
  ) => () => void;
  subscribeToAll: (callback: (message: Message) => void) => () => void;
  subscribeToRefetch: (callback: () => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const [ws, setWs] = useState<WebSocketConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const chatCallbacksRef = useRef<Map<string, Set<(message: Message) => void>>>(
    new Map()
  );
  const onlineCallbacksRef = useRef<
    Map<string, Set<(connection: { user: string; online: boolean }) => void>>
  >(new Map());
  const globalCallbacksRef = useRef<Set<(message: Message) => void>>(new Set());
  const refetchCallbacksRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    if (!session?.user.id) return;

    let wsConnection: WebSocketConnection | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = async () => {
      try {
        const token = await authClient.oneTimeToken.generate();
        if (!token.data?.token) return;

        const [privateKeyD, privateKeyN] = await Promise.all([
          SecureStore.getItemAsync(PRIVATE_KEY_D(session.user.id), {
            requireAuthentication: true,
          }),
          SecureStore.getItemAsync(PRIVATE_KEY_N(session.user.id), {
            requireAuthentication: true,
          }),
        ]);

        if (!privateKeyD || !privateKeyN) return;

        wsConnection = client.ws.subscribe({
          query: {
            token: token.data.token,
          },
        });

        setWs(wsConnection);
        setConnected(true);

        wsConnection.on("error", () => {
          setConnected(false);

          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        wsConnection.on("close", () => {
          setConnected(false);

          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        wsConnection.subscribe(async (event: { data: WebSocketMessage }) => {
          const data = event.data;

          if (data.type === "message") {
            const decryptedContent = await decryptString(data.content, {
              d: privateKeyD,
              n: privateKeyN,
            });

            const message: Message = {
              id: data.id,
              content: decryptedContent,
              sender: data.sender,
              timestamp: new Date(data.timestamp),
              self: data.sender === session.user.id,
              chatId: data.chatId,
              read: data.sender === session.user.id,
            };

            try {
              await db
                .insert(schema.message)
                .values(message)
                .onConflictDoNothing();
            } catch (error) {
              console.error("Error saving message:", error);
            }

            const callbacks = chatCallbacksRef.current.get(data.chatId);
            if (callbacks) callbacks.forEach((callback) => callback(message));

            globalCallbacksRef.current.forEach((callback) => callback(message));
          } else if (data.type === "connection") {
            const callbacks = onlineCallbacksRef.current.get(data.user);
            if (callbacks) callbacks.forEach((callback) => callback(data));
          } else if (data.type === "refetch") {
            refetchCallbacksRef.current.forEach((callback) => callback());
          }
        });
      } catch (error) {
        console.error("Failed to connect to WebSocket:", error);
        setConnected(false);

        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      wsConnection?.close();
      setWs(null);
      setConnected(false);
    };
  }, [session?.user.id]);

  const sendMessage = useCallback(
    async (
      chatId: string,
      content: string,
      receivers: Array<{ id: string; publicKeyE: string; publicKeyN: string }>
    ) => {
      if (!ws || !connected) {
        console.warn("WebSocket not connected");
        return;
      }

      const encryptionPromises = receivers.map(async (receiver) => {
        const encryptedMessage = await encryptString(content, {
          e: receiver.publicKeyE,
          n: receiver.publicKeyN,
        });

        return {
          content: encryptedMessage,
          receiver: receiver.id,
          chatId,
        };
      });

      const encryptedMessages = await Promise.all(encryptionPromises);

      for (const message of encryptedMessages) {
        ws.send(message);
      }
    },
    [ws, connected]
  );

  const subscribeToChat = useCallback(
    (chatId: string, callback: (message: Message) => void) => {
      if (!chatCallbacksRef.current.has(chatId))
        chatCallbacksRef.current.set(chatId, new Set());

      chatCallbacksRef.current.get(chatId)!.add(callback);

      return () => {
        const callbacks = chatCallbacksRef.current.get(chatId);

        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) chatCallbacksRef.current.delete(chatId);
        }
      };
    },
    []
  );

  const subscribeToUser = useCallback(
    (
      userId: string,
      callback: (connection: { user: string; online: boolean }) => void
    ) => {
      if (!onlineCallbacksRef.current.has(userId))
        onlineCallbacksRef.current.set(userId, new Set());

      onlineCallbacksRef.current.get(userId)!.add(callback);

      return () => {
        const callbacks = onlineCallbacksRef.current.get(userId);
        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) onlineCallbacksRef.current.delete(userId);
        }
      };
    },
    []
  );

  const subscribeToAll = useCallback((callback: (message: Message) => void) => {
    globalCallbacksRef.current.add(callback);

    return () => {
      globalCallbacksRef.current.delete(callback);
    };
  }, []);

  const subscribeToRefetch = useCallback((callback: () => void) => {
    refetchCallbacksRef.current.add(callback);

    return () => {
      refetchCallbacksRef.current.delete(callback);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        connected,
        sendMessage,
        subscribeToChat,
        subscribeToAll,
        subscribeToUser,
        subscribeToRefetch,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}
