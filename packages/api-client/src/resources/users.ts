import type { HttpClient } from "../http.js";
import type {
  UpdateProfileRequest,
  UserProfileResponse,
  UserResponse,
  UserSearchResponse,
} from "../types.js";

export interface UserResource {
  getMe(): Promise<UserResponse>;
  getUser(userId: string): Promise<UserProfileResponse>;
  updateMe(data: UpdateProfileRequest): Promise<UserResponse>;
  search(query: string): Promise<UserSearchResponse>;
}

export function createUserResource(http: HttpClient): UserResource {
  return {
    getMe: () => http.get<UserResponse>("/users/me"),
    getUser: (userId) => http.get<UserProfileResponse>(`/users/${userId}`),
    updateMe: (data) => http.patch<UserResponse>("/users/me", data),
    search: (query) => http.get<UserSearchResponse>("/users/search", { q: query }),
  };
}
