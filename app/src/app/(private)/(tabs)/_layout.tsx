import BaseLayout from "@/components/base-layout";
import { authClient } from "@/lib/auth";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";

export default function PublicLayout() {
  const { data: session } = authClient.useSession();

  return (
    <BaseLayout>
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <Label>Chats</Label>
          <Icon sf="message.fill" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="profile">
          <Label>{session?.user.name ?? "Profilo"}</Label>
          <Icon sf="person.fill" />
        </NativeTabs.Trigger>
      </NativeTabs>
    </BaseLayout>
  );
}
