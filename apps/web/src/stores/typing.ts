import { create } from "zustand";

interface TypingUser {
  userId: string;
  username: string;
  expiresAt: number;
}

interface TypingState {
  typing: Map<string, Map<string, TypingUser>>;
  addTyping: (channelId: string, userId: string, username: string) => void;
  getTyping: (channelId: string) => TypingUser[];
}

const TYPING_TIMEOUT = 8000;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export const useTypingStore = create<TypingState>()((set, get) => {
  // Start cleanup interval on first use
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      const { typing } = get();
      let changed = false;

      for (const [channelId, users] of typing) {
        for (const [userId, user] of users) {
          if (user.expiresAt <= now) {
            users.delete(userId);
            changed = true;
          }
        }
        if (users.size === 0) {
          typing.delete(channelId);
          changed = true;
        }
      }

      if (changed) {
        set({ typing: new Map(typing) });
      }
    }, 1000);
  }

  return {
    typing: new Map(),

    addTyping: (channelId, userId, username) => {
      const { typing } = get();
      let channelTyping = typing.get(channelId);
      if (!channelTyping) {
        channelTyping = new Map();
        typing.set(channelId, channelTyping);
      }

      channelTyping.set(userId, {
        userId,
        username,
        expiresAt: Date.now() + TYPING_TIMEOUT,
      });

      set({ typing: new Map(typing) });
    },

    getTyping: (channelId) => {
      const channelTyping = get().typing.get(channelId);
      if (!channelTyping) {
        return [];
      }
      return Array.from(channelTyping.values()).filter((u) => u.expiresAt > Date.now());
    },
  };
});
