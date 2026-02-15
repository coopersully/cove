import { createApiClient } from "@cove/api-client";
import type { TokenProvider } from "@cove/api-client";
import { useAuthStore } from "../stores/auth.js";

const tokenProvider: TokenProvider = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  onTokensRefreshed: (accessToken, refreshToken) => {
    useAuthStore.getState().setTokens(accessToken, refreshToken);
  },
  onAuthFailure: () => {
    useAuthStore.getState().logout();
  },
};

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? "http://localhost:4100",
  tokenProvider,
});
