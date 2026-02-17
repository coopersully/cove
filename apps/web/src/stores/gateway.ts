import { create } from "zustand";
import { GatewayClient } from "../lib/gateway.js";

interface GatewayState {
  client: GatewayClient | null;
  status: "disconnected" | "connecting" | "connected" | "resuming";
  sessionId: string | null;
  initialize: (url: string, getToken: () => string | null) => void;
  disconnect: () => void;
}

export const useGatewayStore = create<GatewayState>()((set, get) => ({
  client: null,
  status: "disconnected",
  sessionId: null,

  initialize: (url, getToken) => {
    const existing = get().client;
    if (existing) {
      existing.disconnect();
    }

    const client = new GatewayClient();

    client.setStatusHandler((status) => {
      set({
        status: status as GatewayState["status"],
        sessionId: client.currentSessionId,
      });
    });

    set({ client, status: "connecting" });
    client.connect(url, getToken);
  },

  disconnect: () => {
    const { client } = get();
    if (client) {
      client.disconnect();
    }
    set({ client: null, status: "disconnected", sessionId: null });
  },
}));
