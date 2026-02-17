import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function usePins(channelId: string) {
  return useQuery({
    queryKey: ["channels", channelId, "pins"],
    queryFn: () => api.pins.list(channelId),
  });
}

export function usePinMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.pins.pin(channelId, messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["channels", channelId, "pins"],
      });
    },
  });
}

export function useUnpinMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.pins.unpin(channelId, messageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["channels", channelId, "pins"],
      });
    },
  });
}
