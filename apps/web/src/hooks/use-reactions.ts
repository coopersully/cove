import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useAddReaction(channelId: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.add(channelId, messageId, emoji),
  });
}

export function useRemoveReaction(channelId: string) {
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      api.reactions.remove(channelId, messageId, emoji),
  });
}
