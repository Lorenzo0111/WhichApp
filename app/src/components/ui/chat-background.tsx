import { MessageCircleIcon } from "lucide-react-native";
import { View, useWindowDimensions } from "react-native";
import { useCSSVariable } from "uniwind";

export function ChatBackground() {
  const primaryColor = useCSSVariable("--color-background");
  const { width, height } = useWindowDimensions();

  const iconSize = 40;
  const gap = iconSize / 1.5;
  const cols = Math.ceil(width / (iconSize + gap)) + 1;
  const rows = Math.ceil(height / (iconSize + gap)) + 1;
  const totalIcons = cols * rows;

  return (
    <View className="absolute inset-0 bg-secondary overflow-hidden py-4">
      <View className="flex-row flex-wrap justify-center" style={{ gap }}>
        {Array.from({ length: totalIcons }).map((_, i) => (
          <View key={i} style={{ width: iconSize, height: iconSize }}>
            <MessageCircleIcon
              size={iconSize}
              color={(primaryColor as string) ?? "#000"}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
