import { useAuth } from "@clerk/clerk-react";
import { useMemo } from "react";
import * as api from "./api";

/** API helpers bound to the current Clerk session token (sent as a bearer header). */
export function useApi() {
  const { getToken } = useAuth();
  return useMemo(
    () => ({
      getChats: async () => api.getChats(await getToken()),
      createChat: async (title?: string) => api.createChat(await getToken(), title),
      deleteChat: async (id: string) => api.deleteChat(await getToken(), id),
      getMessages: async (chatId: string) => api.getMessages(await getToken(), chatId),
      getMemories: async () => api.getMemories(await getToken()),
      deleteMemory: async (id: string) => api.deleteMemory(await getToken(), id),
    }),
    [getToken]
  );
}
