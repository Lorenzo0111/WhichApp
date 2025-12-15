import * as schema from "@/db/schema";
import { Treaty } from "@elysiajs/eden";
import { InferSelectModel } from "drizzle-orm";
import client from "./fetcher";

export type User = Treaty.Data<typeof client.users.search.get>[number];

const chat = client.chats({ id: "" }).get;
export type Chat = Treaty.Data<typeof client.chats.get>[number];
export type FullChat = Treaty.Data<typeof chat>;

export type Message = InferSelectModel<typeof schema.message> & {
  self: boolean;
};

export type WebSocketConnection = ReturnType<typeof client.ws.subscribe>;
