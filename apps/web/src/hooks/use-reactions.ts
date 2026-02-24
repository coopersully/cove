import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useGatewayStore } from "../stores/gateway.js";

export function useAddReaction(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.add(channelId, messageId, emoji),
    onSettled: () => {
      if (useGatewayStore.getState().status !== "connected") {
        void queryClient.invalidateQueries({
          queryKey: ["channels", channelId, "messages"],
        });
      }
    },
  });
}

export function useRemoveReaction(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.remove(channelId, messageId, emoji),
    onSettled: () => {
      if (useGatewayStore.getState().status !== "connected") {
        void queryClient.invalidateQueries({
          queryKey: ["channels", channelId, "messages"],
        });
      }
    },
  });
}
