import type { HttpClient } from "../http.js";
import type {
  AuthResponse,
  ForgotPasswordRequest,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SuccessResponse,
  TokenResponse,
} from "../types.js";

export interface AuthResource {
  register(data: RegisterRequest): Promise<AuthResponse>;
  login(data: LoginRequest): Promise<AuthResponse>;
  refresh(data: RefreshRequest): Promise<TokenResponse>;
  forgotPassword(data: ForgotPasswordRequest): Promise<SuccessResponse>;
  resetPassword(data: ResetPasswordRequest): Promise<SuccessResponse>;
}

export function createAuthResource(http: HttpClient): AuthResource {
  return {
    register: (data) => http.post<AuthResponse>("/auth/register", data),
    login: (data) => http.post<AuthResponse>("/auth/login", data),
    refresh: (data) => http.post<TokenResponse>("/auth/refresh", data),
    forgotPassword: (data) => http.post<SuccessResponse>("/auth/forgot-password", data),
    resetPassword: (data) => http.post<SuccessResponse>("/auth/reset-password", data),
  };
}
