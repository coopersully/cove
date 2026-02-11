import type { User } from "@hearth/api-client";
import { create } from "zustand";
import { api } from "../lib/api.js";

const REFRESH_TOKEN_KEY = "hearth:refreshToken";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isInitialized: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isInitialized: false,

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ accessToken, refreshToken });
  },

  setUser: (user) => {
    set({ user });
  },

  login: async (email, password) => {
    const response = await api.auth.login({ email, password });
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    set({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
      isInitialized: true,
    });
  },

  register: async (username, email, password) => {
    const response = await api.auth.register({ username, email, password });
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    set({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      user: response.user,
      isInitialized: true,
    });
  },

  logout: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
    });
  },

  initialize: async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) {
      set({ isInitialized: true });
      return;
    }

    try {
      const tokens = await api.auth.refresh({ refreshToken: storedRefreshToken });
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });

      const { user } = await api.users.getMe();
      set({ user, isInitialized: true });
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isInitialized: true,
      });
    }
  },
}));
