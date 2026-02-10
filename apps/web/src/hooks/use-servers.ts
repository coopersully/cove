import type { CreateServerRequest } from "@hearth/api-client";
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
