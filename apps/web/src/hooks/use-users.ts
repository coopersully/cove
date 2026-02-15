import type { UpdateProfileRequest } from "@hearth/api-client";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => api.users.updateMe(data),
    onSuccess: (response) => {
      setUser(response.user);
    },
  });
}
