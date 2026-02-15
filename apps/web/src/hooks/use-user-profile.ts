import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => api.users.getUser(userId),
    staleTime: 60_000,
  });
}
