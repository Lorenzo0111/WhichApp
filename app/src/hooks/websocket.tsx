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

/**
 * @description Type for the WebSocket message
 */
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

/**
 * @description Type for the users that must receive a message from the WebSocket
 */
interface WebSocketReceiver {
  id: string;
  publicKeyE: string;
  publicKeyN: string;
}

/**
 * @description Type for the WebSocket context
 */
interface WebSocketContextType {
  /**
   * @description Indicates if the WebSocket is connected
   */
  connected: boolean;
  /**
   * @description Send a message to one or more users
   * @param chatId - The ID of the chat
   * @param content - The content of the message
   * @param receivers - The users that must receive the message
   */
  sendMessage: (
    chatId: string,
    content: string,
    receivers: Array<WebSocketReceiver>,
  ) => Promise<void>;
  /**
   * @description Add a listener to a chat to receive its messages
   * @param chatId - The ID of the chat
   * @param callback - The function to call when a message is received
   */
  subscribeToChat: (
    chatId: string,
    callback: (message: Message) => void,
  ) => () => void;
  /**
   * @description Add a listener to a user to receive the updates of the connection status
   * @param userId - The ID of the user
   * @param callback - The function to call when a connection is received
   */
  subscribeToUser: (
    userId: string,
    callback: (connection: { user: string; online: boolean }) => void,
  ) => () => void;
  /**
   * @description Add a listener to all messages
   * @param callback - The function to call when a message is received
   */
  subscribeToAll: (callback: (message: Message) => void) => () => void;
  /**
   * @description Add a listener to all the updates of the chat list
   * @param callback - The function to call when an update is received
   */
  subscribeToRefetch: (callback: () => void) => () => void;
}

/**
 * @description Context for the WebSocket
 */
const WebSocketContext = createContext<WebSocketContextType | null>(null);

/**
 * @description Provider for the WebSocket
 * @param children - The children of the provider
 * @returns The provider for the WebSocket
 */
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();

  // State of the WebSocket
  const [ws, setWs] = useState<WebSocketConnection | null>(null);
  const [connected, setConnected] = useState(false);

  // Ref for the listeners
  const chatCallbacksRef = useRef<Map<string, Set<(message: Message) => void>>>(
    new Map(),
  );
  const onlineCallbacksRef = useRef<
    Map<string, Set<(connection: { user: string; online: boolean }) => void>>
  >(new Map());
  const globalCallbacksRef = useRef<Set<(message: Message) => void>>(new Set());
  const refetchCallbacksRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    // If the user is not authenticated, do not connect
    if (!session?.user.id) return;

    // Variables for the connection
    let wsConnection: WebSocketConnection | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    // Function for the connection
    const connect = async () => {
      try {
        // Generate a one-time token for the connection
        const token = await authClient.oneTimeToken.generate();
        if (!token.data?.token) return;

        // Get the private keys from the storage
        const [privateKeyD, privateKeyN] = await Promise.all([
          SecureStore.getItemAsync(PRIVATE_KEY_D(session.user.id), {
            requireAuthentication: true,
          }),
          SecureStore.getItemAsync(PRIVATE_KEY_N(session.user.id), {
            requireAuthentication: true,
          }),
        ]);

        // If there are no private keys, do not connect
        if (!privateKeyD || !privateKeyN) return;

        // Connect to the WebSocket
        wsConnection = client.ws.subscribe({
          query: {
            token: token.data.token,
          },
        });

        // Update the state of the WebSocket
        setWs(wsConnection);
        setConnected(true);

        // Handling of the errors
        wsConnection.on("error", () => {
          // Update the state of the WebSocket
          setConnected(false);

          // Try to reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        // Handling of the disconnection
        wsConnection.on("close", () => {
          // Update the state of the WebSocket
          setConnected(false);

          // Try to reconnect after 3 seconds
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        // Listener for the messages of the WebSocket
        wsConnection.subscribe(async (event: { data: WebSocketMessage }) => {
          const data = event.data;

          // If the message is textual
          if (data.type === "message") {
            // Decrypt the content of the message
            const decryptedContent = await decryptString(data.content, {
              d: privateKeyD,
              n: privateKeyN,
            });

            // Create the message
            const message: Message = {
              id: data.id,
              content: decryptedContent,
              sender: data.sender,
              timestamp: new Date(data.timestamp),
              self: data.sender === session.user.id,
              chatId: data.chatId,
              read: data.sender === session.user.id,
            };

            // Save the message in the database
            try {
              await db
                .insert(schema.message)
                .values(message)
                .onConflictDoNothing();
            } catch (error) {
              console.error("Error saving message:", error);
            }

            // Notify the listeners of the new message
            const callbacks = chatCallbacksRef.current.get(data.chatId);
            if (callbacks) callbacks.forEach((callback) => callback(message));

            globalCallbacksRef.current.forEach((callback) => callback(message));
          } else if (data.type === "connection") {
            // If it is an update of the connection status, notify the listeners
            const callbacks = onlineCallbacksRef.current.get(data.user);
            if (callbacks) callbacks.forEach((callback) => callback(data));
          } else if (data.type === "refetch") {
            // If it is an update of the chat list, notify the listeners
            refetchCallbacksRef.current.forEach((callback) => callback());
          }
        });
      } catch (error) {
        // If there are errors, log them
        console.error("Failed to connect to WebSocket:", error);
        setConnected(false);

        // Try to reconnect after 3 seconds
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    // Connect to the WebSocket
    connect();

    // When the component is unmounted, close the connection
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
      receivers: Array<{ id: string; publicKeyE: string; publicKeyN: string }>,
    ) => {
      // If the WebSocket is not connected, log a warning
      if (!ws || !connected) {
        console.warn("WebSocket not connected");
        return;
      }

      // Encrypt the message for each receiver with their public keys
      const encryptedMessages = await Promise.all(
        receivers.map(async (receiver) => {
          const encryptedMessage = await encryptString(content, {
            e: receiver.publicKeyE,
            n: receiver.publicKeyN,
          });

          return {
            content: encryptedMessage,
            receiver: receiver.id,
            chatId,
          };
        }),
      );

      // Send the encrypted messages to the WebSocket
      for (const message of encryptedMessages) {
        ws.send(message);
      }
    },
    [ws, connected],
  );

  const subscribeToChat = useCallback(
    (chatId: string, callback: (message: Message) => void) => {
      // If there is no listener for the chat, create one
      if (!chatCallbacksRef.current.has(chatId))
        chatCallbacksRef.current.set(chatId, new Set());

      // Add the listener to the chat
      chatCallbacksRef.current.get(chatId)!.add(callback);

      // When the component is unmounted, remove the listener
      return () => {
        const callbacks = chatCallbacksRef.current.get(chatId);

        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) chatCallbacksRef.current.delete(chatId);
        }
      };
    },
    [],
  );

  const subscribeToUser = useCallback(
    (
      userId: string,
      callback: (connection: { user: string; online: boolean }) => void,
    ) => {
      // If there is no listener for the user status, create one
      if (!onlineCallbacksRef.current.has(userId))
        onlineCallbacksRef.current.set(userId, new Set());

      // Add the listener to the user status
      onlineCallbacksRef.current.get(userId)!.add(callback);

      // When the component is unmounted, remove the listener
      return () => {
        const callbacks = onlineCallbacksRef.current.get(userId);
        if (callbacks) {
          callbacks.delete(callback);

          if (callbacks.size === 0) onlineCallbacksRef.current.delete(userId);
        }
      };
    },
    [],
  );

  const subscribeToAll = useCallback((callback: (message: Message) => void) => {
    // If there is no listener for the global messages, create one
    globalCallbacksRef.current.add(callback);

    return () => globalCallbacksRef.current.delete(callback);
  }, []);

  const subscribeToRefetch = useCallback((callback: () => void) => {
    // If there is no listener for the refetch, create one
    refetchCallbacksRef.current.add(callback);

    return () => refetchCallbacksRef.current.delete(callback);
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
