import { Slot } from "expo-router";
import { StatusBar } from "react-native";

export default function BaseLayout({
  children = <Slot />,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <StatusBar barStyle="light-content" />
    </>
  );
}
