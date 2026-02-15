import type { CreateServerRequest, UpdateServerRequest } from "@cove/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => api.servers.list(),
  });
}

export function useServer(serverId: string) {
  return useQuery({
    queryKey: ["servers", serverId],
    queryFn: () => api.servers.get(serverId),
    enabled: !!serverId,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServerRequest) => api.servers.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useUpdateServer(serverId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateServerRequest) => api.servers.update(serverId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
      void queryClient.invalidateQueries({ queryKey: ["servers", serverId] });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serverId: string) => api.servers.delete(serverId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useLeaveServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (serverId: string) => api.servers.leave(serverId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useJoinServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serverId, inviteCode }: { serverId: string; inviteCode?: string }) =>
      api.servers.join(serverId, inviteCode ? { inviteCode } : undefined),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}
