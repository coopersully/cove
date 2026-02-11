import type { HttpClient } from "../http.js";
import type {
  AuthResponse,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  TokenResponse,
} from "../types.js";

export interface AuthResource {
  register(data: RegisterRequest): Promise<AuthResponse>;
  login(data: LoginRequest): Promise<AuthResponse>;
  refresh(data: RefreshRequest): Promise<TokenResponse>;
}

export function createAuthResource(http: HttpClient): AuthResource {
  return {
    register: (data) => http.post<AuthResponse>("/auth/register", data),
    login: (data) => http.post<AuthResponse>("/auth/login", data),
    refresh: (data) => http.post<TokenResponse>("/auth/refresh", data),
  };
}
