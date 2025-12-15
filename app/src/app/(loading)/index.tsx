import { View } from "react-native";
import { Loading } from "@/components/loading";
import { ChatBackground } from "@/components/ui/chat-background";

export default function LoadingScreen() {
  return (
    <View className="flex-1 bg-background justify-end relative">
      <ChatBackground />

      <View className="bg-background w-full h-1/2 mt-auto flex flex-col items-center justify-center rounded-3xl z-10">
        <Loading message="Caricamento in corso..." />
      </View>
    </View>
  );
}
