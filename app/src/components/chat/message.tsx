import { FullChat, Message } from "@/lib/types";
import classNames from "classnames";
import { Image } from "expo-image";
import { Text, View } from "react-native";

export function MessageItem({
  content,
  senderObject,
  self,
}: Message & {
  senderObject: FullChat["members"][number] | null;
}) {
  return (
    <View
      className={classNames(
        "flex gap-2 justify-start",
        self ? "flex-row-reverse" : "flex-row"
      )}
    >
      {!self && (
        <View className="w-8 h-8 rounded-full">
          <Image
            source={{
              uri:
                senderObject?.image ||
                `https://placehold.co/30?text=${senderObject?.name.charAt(0)}`,
            }}
            style={{ width: 30, height: 30, borderRadius: 100 }}
          />
        </View>
      )}

      <View
        className={classNames(
          "flex flex-row py-2 px-4 rounded-2xl rounded-br-sm w-fit max-w-2/3",
          self ? "bg-linear-to-r from-primary to-secondary" : "bg-card"
        )}
      >
        <Text className="text-text text-sm">{content}</Text>
      </View>
    </View>
  );
}
