import { Header } from "@/components/header";
import { UserItem } from "@/components/home/user";
import { Input } from "@/components/ui/input";
import client from "@/lib/fetcher";
import { User } from "@/lib/types";
import { useRouter } from "expo-router";
import { ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ColorValue,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCSSVariable } from "uniwind";

export default function NewChatScreen() {
  const router = useRouter();
  const textColor = useCSSVariable("--color-text");
  const placeholderColor = useCSSVariable("--color-placeholder");

  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query || query.trim() === "") {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      client.users.search
        .get({ query: { query: query.trim() } })
        .then((res) => {
          setUsers(res.data ?? []);
        })
        .finally(() => {
          setIsSearching(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <View className="flex-1 bg-background">
      <Header>
        <View className="flex flex-row items-center gap-2">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeftIcon
              color={(textColor as ColorValue) ?? "white"}
              size={24}
            />
          </TouchableOpacity>

          <Text className="text-text text-2xl font-bold ml-2">New Chat</Text>
        </View>
      </Header>

      <View className="px-4 py-4">
        <View className="relative justify-center">
          <View className="absolute left-3 z-10">
            <SearchIcon
              size={20}
              color={(placeholderColor as ColorValue) ?? "gray"}
            />
          </View>
          <Input
            placeholder="Search for a user..."
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            className="bg-card pl-10"
          />
        </View>
      </View>

      <FlatList
        data={users}
        renderItem={({ item }) => <UserItem {...item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-border mx-4" />}
        keyExtractor={(item) => item.id}
        className="flex-1"
        contentContainerClassName="pb-4"
        ListEmptyComponent={
          query.length > 0 && !isSearching ? (
            <View className="flex-1 items-center justify-center pt-10">
              <XIcon
                size={50}
                color={(placeholderColor as ColorValue) ?? "gray"}
              />
              <Text className="text-placeholder text-lg">No user found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
