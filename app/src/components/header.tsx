import { View } from "react-native";

export type HeaderProps = {
  children: React.ReactNode;
};

export function Header({ children }: HeaderProps) {
  return (
    <View className="w-full bg-linear-to-r from-primary to-secondary p-4 pt-14 h-25 justify-between flex-row items-center">
      {children}
    </View>
  );
}
