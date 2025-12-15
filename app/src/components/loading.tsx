import LottieView, { LottieViewProps } from "lottie-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export type LoadingProps = {
  message: string;
  animation?: LottieViewProps["source"];
};

export function Loading({
  message,
  animation = require("../../assets/lock.json"),
}: LoadingProps) {
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((dots) => (dots + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, [dots]);

  return (
    <View className="flex-1 bg-background items-center justify-center">
      <LottieView
        autoPlay
        style={{
          width: 200,
          height: 200,
        }}
        source={animation}
      />
      <Text className="text-text text-center text-xl font-bold pt-2">
        {message}
        {Array.from({ length: dots })
          .map((_) => ".")
          .join("")}
      </Text>
    </View>
  );
}
