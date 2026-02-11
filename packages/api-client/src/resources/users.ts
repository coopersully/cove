import type { HttpClient } from "../http.js";
import type { UpdateProfileRequest, UserResponse } from "../types.js";

export interface UserResource {
  getMe(): Promise<UserResponse>;
  updateMe(data: UpdateProfileRequest): Promise<UserResponse>;
}

export function createUserResource(http: HttpClient): UserResource {
  return {
    getMe: () => http.get<UserResponse>("/users/me"),
    updateMe: (data) => http.patch<UserResponse>("/users/me", data),
  };
}
