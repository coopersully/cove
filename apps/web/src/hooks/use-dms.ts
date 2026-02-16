import type { CreateDmRequest } from "@cove/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { api } from "../lib/api.js";

export function useDms() {
  return useQuery({
    queryKey: ["dms"],
    queryFn: () => api.dms.list(),
  });
}

export function useDm(channelId: string) {
  return useQuery({
    queryKey: ["dms", channelId],
    queryFn: () => api.dms.get(channelId),
    enabled: !!channelId,
  });
}

export function useCreateDm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (data: CreateDmRequest) => api.dms.create(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["dms"] });
      void navigate(`/dms/${result.channel.id}`);
    },
  });
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["users", "search", query],
    queryFn: () => api.users.search(query),
    enabled: query.length >= 1,
  });
}
