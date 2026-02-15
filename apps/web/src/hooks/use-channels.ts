import type { CreateChannelRequest, UpdateChannelRequest } from "@hearth/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useChannels(serverId: string) {
  return useQuery({
    queryKey: ["servers", serverId, "channels"],
    queryFn: () => api.channels.list(serverId),
  });
}

export function useCreateChannel(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateChannelRequest) => api.channels.create(serverId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers", serverId, "channels"] });
    },
  });
}

export function useUpdateChannel(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ channelId, data }: { channelId: string; data: UpdateChannelRequest }) =>
      api.channels.update(channelId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers", serverId, "channels"] });
    },
  });
}

export function useDeleteChannel(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (channelId: string) => api.channels.delete(channelId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers", serverId, "channels"] });
    },
  });
}
