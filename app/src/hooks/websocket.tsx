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
 * @description Tipo di messaggio del WebSocket
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
 * @description Tipo per gli utenti che devono ricevere un messaggio dal WebSocket
 */
interface WebSocketReceiver {
  id: string;
  publicKeyE: string;
  publicKeyN: string;
}

/**
 * @description Tipo per il contesto del WebSocket
 */
interface WebSocketContextType {
  /**
   * @description Indica se il WebSocket è connesso
   */
  connected: boolean;
  /**
   * @description Invia un messaggio a uno o più utenti
   * @param chatId - L'ID della chat
   * @param content - Il contenuto del messaggio
   * @param receivers - Gli utenti che devono ricevere il messaggio
   */
  sendMessage: (
    chatId: string,
    content: string,
    receivers: Array<WebSocketReceiver>
  ) => Promise<void>;
  /**
   * @description Aggiunge un listener a una chat per ricevere i suoi messaggi
   * @param chatId - L'ID della chat
   * @param callback - La funzione da chiamare quando viene ricevuto un messaggio
   */
  subscribeToChat: (
    chatId: string,
    callback: (message: Message) => void
  ) => () => void;
  /**
   * @description Aggiunge un listener a un utente per ricevere gli aggiornamenti dello stato di connessione
   * @param userId - L'ID dell'utente
   * @param callback - La funzione da chiamare quando viene ricevuta una connessione
   */
  subscribeToUser: (
    userId: string,
    callback: (connection: { user: string; online: boolean }) => void
  ) => () => void;
  /**
   * @description Aggiunge un listener a tutti i messaggi
   * @param callback - La funzione da chiamare quando viene ricevuto un messaggio
   */
  subscribeToAll: (callback: (message: Message) => void) => () => void;
  /**
   * @description Aggiunge un listener a tutti gli aggiornamenti della lista delle chat
   * @param callback - La funzione da chiamare quando viene ricevuto un aggiornamento
   */
  subscribeToRefetch: (callback: () => void) => () => void;
}

/**
 * @description Contesto del WebSocket
 */
const WebSocketContext = createContext<WebSocketContextType | null>(null);

/**
 * @description Provider del WebSocket
 * @param children - I figli del provider
 * @returns Il provider del WebSocket
 */
export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();

  // Stato del WebSocket
  const [ws, setWs] = useState<WebSocketConnection | null>(null);
  const [connected, setConnected] = useState(false);

  // Ref per i listener
  const chatCallbacksRef = useRef<Map<string, Set<(message: Message) => void>>>(
    new Map()
  );
  const onlineCallbacksRef = useRef<
    Map<string, Set<(connection: { user: string; online: boolean }) => void>>
  >(new Map());
  const globalCallbacksRef = useRef<Set<(message: Message) => void>>(new Set());
  const refetchCallbacksRef = useRef<Set<() => void>>(new Set());

  useEffect(() => {
    // Se l'utente non è autenticato, non connettere
    if (!session?.user.id) return;

    // Variabili per la connessione
    let wsConnection: WebSocketConnection | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    // Funzione per la connessione
    const connect = async () => {
      try {
        // Genera un OTT per la connessione
        const token = await authClient.oneTimeToken.generate();
        if (!token.data?.token) return;

        // Ottiene le chiavi private dallo storage
        const [privateKeyD, privateKeyN] = await Promise.all([
          SecureStore.getItemAsync(PRIVATE_KEY_D(session.user.id), {
            requireAuthentication: true,
          }),
          SecureStore.getItemAsync(PRIVATE_KEY_N(session.user.id), {
            requireAuthentication: true,
          }),
        ]);

        // Se non ci sono chiavi private, non connettere
        if (!privateKeyD || !privateKeyN) return;

        // Connette al WebSocket
        wsConnection = client.ws.subscribe({
          query: {
            token: token.data.token,
          },
        });

        // Aggiorna lo stato del WebSocket
        setWs(wsConnection);
        setConnected(true);

        // Gestione degli errori
        wsConnection.on("error", () => {
          // Aggiorna lo stato del WebSocket
          setConnected(false);

          // Prova a riconnettere dopo 3 secondi
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        // Gestione della disconnessione
        wsConnection.on("close", () => {
          // Aggiorna lo stato del WebSocket
          setConnected(false);

          // Prova a riconnettere dopo 3 secondi
          reconnectTimeout = setTimeout(() => {
            connect();
          }, 3000);
        });

        // Listener per i messaggi del WebSocket
        wsConnection.subscribe(async (event: { data: WebSocketMessage }) => {
          const data = event.data;

          // Se il messaggio è testuale
          if (data.type === "message") {
            // Decifra il contenuto del messaggio
            const decryptedContent = await decryptString(data.content, {
              d: privateKeyD,
              n: privateKeyN,
            });

            // Crea il messaggio
            const message: Message = {
              id: data.id,
              content: decryptedContent,
              sender: data.sender,
              timestamp: new Date(data.timestamp),
              self: data.sender === session.user.id,
              chatId: data.chatId,
              read: data.sender === session.user.id,
            };

            // Salva il messaggio nel database
            try {
              await db
                .insert(schema.message)
                .values(message)
                .onConflictDoNothing();
            } catch (error) {
              console.error("Error saving message:", error);
            }

            // Avvisa i listener del nuovo messaggio
            const callbacks = chatCallbacksRef.current.get(data.chatId);
            if (callbacks) callbacks.forEach((callback) => callback(message));

            globalCallbacksRef.current.forEach((callback) => callback(message));
          } else if (data.type === "connection") {
            // Se è un aggiornamento dello stato di connessione, avvisa i listener
            const callbacks = onlineCallbacksRef.current.get(data.user);
            if (callbacks) callbacks.forEach((callback) => callback(data));
          } else if (data.type === "refetch") {
            // Se è un aggiornamento della lista delle chat, avvisa i listener
            refetchCallbacksRef.current.forEach((callback) => callback());
          }
        });
      } catch (error) {
        // Se ci sono errori, loggali
        console.error("Failed to connect to WebSocket:", error);
        setConnected(false);

        // Prova a riconnettere dopo 3 secondi
        reconnectTimeout = setTimeout(() => {
          connect();
        }, 3000);
      }
    };

    // Connette al WebSocket
    connect();

    // Quando il componente viene smontato, chiude la connessione
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
      // Se il WebSocket non è connesso, logga un avviso
      if (!ws || !connected) {
        console.warn("WebSocket not connected");
        return;
      }

      // Cifra il messaggio per ogni destinatario con le loro chiavi pubbliche
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
        })
      );

      // Invia i messaggi cifrati al WebSocket
      for (const message of encryptedMessages) {
        ws.send(message);
      }
    },
    [ws, connected]
  );

  const subscribeToChat = useCallback(
    (chatId: string, callback: (message: Message) => void) => {
      // Se non esiste un listener per la chat, crea uno
      if (!chatCallbacksRef.current.has(chatId))
        chatCallbacksRef.current.set(chatId, new Set());

      // Aggiunge il listener alla chat
      chatCallbacksRef.current.get(chatId)!.add(callback);

      // Quando il componente viene smontato, rimuove il listener
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
      // Se non esiste un listener per lo stato dell'utente, crea uno
      if (!onlineCallbacksRef.current.has(userId))
        onlineCallbacksRef.current.set(userId, new Set());

      // Aggiunge il listener allo stato dell'utente
      onlineCallbacksRef.current.get(userId)!.add(callback);

      // Quando il componente viene smontato, rimuove il listener
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
    // Se non esiste un listener per i messaggi globali, crea uno
    globalCallbacksRef.current.add(callback);

    return () => globalCallbacksRef.current.delete(callback);
  }, []);

  const subscribeToRefetch = useCallback((callback: () => void) => {
    // Se non esiste un listener per i refetch, crea uno
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
