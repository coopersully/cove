import type { SendFriendRequestRequest } from "@cove/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useFriends() {
  return useQuery({
    queryKey: ["friends"],
    queryFn: () => api.friends.list(),
  });
}

export function useIncomingRequests() {
  return useQuery({
    queryKey: ["friend-requests", "incoming"],
    queryFn: () => api.friends.incomingRequests(),
  });
}

export function useOutgoingRequests() {
  return useQuery({
    queryKey: ["friend-requests", "outgoing"],
    queryFn: () => api.friends.outgoingRequests(),
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendFriendRequestRequest) => api.friends.sendRequest(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", "outgoing"] });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => api.friends.acceptRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", "incoming"] });
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}

export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => api.friends.declineRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", "incoming"] });
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", "outgoing"] });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => api.friends.remove(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
}
