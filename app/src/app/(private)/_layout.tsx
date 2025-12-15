import BaseLayout from "@/components/base-layout";
import { WebSocketProvider } from "@/hooks/websocket";
import { ReactNode } from "react";

export default function PrivateLayout({ children }: { children?: ReactNode }) {
  return (
    <WebSocketProvider>
      <BaseLayout>{children}</BaseLayout>
    </WebSocketProvider>
  );
}
