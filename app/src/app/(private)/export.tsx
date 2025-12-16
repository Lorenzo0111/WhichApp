import { ChatBackground } from "@/components/ui/chat-background";
import { authClient } from "@/lib/auth";
import { PRIVATE_KEY_D, PRIVATE_KEY_PREFIX } from "@/lib/constants";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { ArrowLeftIcon, InfoIcon, ShieldAlertIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ColorValue, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useCSSVariable } from "uniwind";

export default function ExportScreen() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const textColor = useCSSVariable("--color-text");
  const primaryColor = useCSSVariable("--color-primary");
  const errorColor = useCSSVariable("--color-error");

  const [exportData, setExportData] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;

    (async () => {
      const d = await SecureStore.getItemAsync(PRIVATE_KEY_D(session.user.id), {
        requireAuthentication: true,
      });

      if (!d) return;

      setExportData(PRIVATE_KEY_PREFIX + btoa(d));
    })();
  }, [session?.user.id]);

  return (
    <View className="flex-1 bg-background relative">
      <ChatBackground />

      <View className="absolute inset-0 flex flex-col">
        <View className="w-full p-4 pt-14 h-25 flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeftIcon
              color={(textColor as ColorValue) ?? "white"}
              size={24}
            />
          </TouchableOpacity>

          <Text className="text-text text-2xl font-bold ml-2">
            Esporta Chiavi
          </Text>
        </View>

        <View className="flex-1 items-center justify-center p-4">
          <View className="bg-background p-6 rounded-3xl w-full items-center shadow-lg border border-border">
            {exportData ? (
              <>
                <View className="bg-white p-4 rounded-xl overflow-hidden mb-6">
                  <QRCode value={exportData} size={250} />
                </View>

                <View className="flex-row items-center gap-2 mb-2">
                  <InfoIcon
                    size={20}
                    color={(primaryColor as string) ?? "#000"}
                  />
                  <Text className="text-text text-lg font-bold">
                    Come funziona?
                  </Text>
                </View>

                <Text className="text-input text-center text-sm leading-5 mb-4 px-2">
                  1. Apri WhichApp sul{" "}
                  <Text className="font-bold">nuovo dispositivo</Text>
                  {"\n"}
                  2. Vai su{" "}
                  <Text className="font-bold">"Nessuna chiave trovata"</Text>
                  {"\n"}
                  3. Premi <Text className="font-bold">"Importa"</Text> e
                  scansiona questo codice
                </Text>

                <View className="bg-destructive/10 p-3 rounded-xl flex-row gap-3 items-center w-full">
                  <ShieldAlertIcon
                    size={20}
                    color={(errorColor as string) ?? "red"}
                  />
                  <Text className="text-error text-xs font-medium flex-1">
                    Non condividere questo codice! Chiunque lo scansioni potrà
                    leggere i tuoi messaggi.
                  </Text>
                </View>
              </>
            ) : (
              <Text className="text-text">Caricamento...</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
