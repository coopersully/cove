import type { ReadStateListResponse } from "@cove/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useReadStates() {
  return useQuery({
    queryKey: ["read-states"],
    queryFn: () => api.readStates.list(),
  });
}

export function useAckMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.readStates.ack(channelId, messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({ queryKey: ["read-states"] });

      const previous = queryClient.getQueryData<ReadStateListResponse>(["read-states"]);

      queryClient.setQueryData<ReadStateListResponse>(["read-states"], (old) => {
        if (!old) {
          return old;
        }

        const existing = old.readStates.find((rs) => rs.channelId === channelId);
        if (existing) {
          return {
            readStates: old.readStates.map((rs) =>
              rs.channelId === channelId
                ? { ...rs, lastReadMessageId: messageId, updatedAt: new Date().toISOString() }
                : rs,
            ),
          };
        }

        return {
          readStates: [
            ...old.readStates,
            { channelId, lastReadMessageId: messageId, updatedAt: new Date().toISOString() },
          ],
        };
      });

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["read-states"], context.previous);
      }
    },
  });
}
