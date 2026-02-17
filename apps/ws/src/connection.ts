import crypto from "node:crypto";

import type { WebSocket } from "ws";

import type Redis from "ioredis";

import { verifyAccessToken } from "@cove/auth";
import { db, dmMembers, serverMembers } from "@cove/db";
import {
  GatewayOpcodes,
  getReplayEvents,
  getSession,
  refreshSessionTTL,
  setSession,
} from "@cove/gateway";
import type { GatewayHello, GatewayMessage, GatewayReadyData, SessionState } from "@cove/gateway";
import { eq } from "drizzle-orm";

import type { ClientSession, Dispatcher } from "./dispatcher.js";

const HEARTBEAT_INTERVAL = 41250;
const IDENTIFY_TIMEOUT = 10_000;

export function handleConnection(ws: WebSocket, dispatcher: Dispatcher, redis: Redis): void {
  let client: ClientSession | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastHeartbeatAck = true;
  let identifyTimeout: ReturnType<typeof setTimeout> | null = null;

  // Send Hello
  const hello: GatewayHello = {
    op: GatewayOpcodes.Hello,
    d: { heartbeatInterval: HEARTBEAT_INTERVAL },
  };
  ws.send(JSON.stringify(hello));

  // Set identify timeout
  identifyTimeout = setTimeout(() => {
    if (!client) {
      ws.close(4001, "Identify timeout");
    }
  }, IDENTIFY_TIMEOUT);

  ws.on("message", (raw) => {
    let msg: GatewayMessage;
    try {
      msg = JSON.parse(String(raw)) as GatewayMessage;
    } catch {
      return;
    }

    switch (msg.op) {
      case GatewayOpcodes.Identify:
        if (msg.d && typeof msg.d === "object" && typeof (msg.d as Record<string, unknown>).token === "string") {
          void handleIdentify(msg.d as { token: string });
        }
        break;
      case GatewayOpcodes.Heartbeat:
        handleHeartbeat();
        break;
      case GatewayOpcodes.Resume:
        if (
          msg.d && typeof msg.d === "object" &&
          typeof (msg.d as Record<string, unknown>).token === "string" &&
          typeof (msg.d as Record<string, unknown>).sessionId === "string" &&
          typeof (msg.d as Record<string, unknown>).seq === "number"
        ) {
          void handleResume(msg.d as { token: string; sessionId: string; seq: number });
        }
        break;
    }
  });

  ws.on("close", () => {
    cleanup(false);
  });

  ws.on("error", () => {
    cleanup(false);
  });

  async function handleIdentify(data: { token: string }) {
    if (client) {
      return; // Already identified
    }

    let decoded: { sub: string; username: string };
    try {
      decoded = await verifyAccessToken(data.token);
    } catch {
      ws.close(4004, "Authentication failed");
      return;
    }

    if (identifyTimeout) {
      clearTimeout(identifyTimeout);
      identifyTimeout = null;
    }

    try {
      const userId = decoded.sub;
      const username = decoded.username;

      // Query subscriptions
      const memberRows = await db
        .select({ serverId: serverMembers.serverId })
        .from(serverMembers)
        .where(eq(serverMembers.userId, BigInt(userId)));

      const dmRows = await db
        .select({ channelId: dmMembers.channelId })
        .from(dmMembers)
        .where(eq(dmMembers.userId, BigInt(userId)));

      const serverIds = memberRows.map((r) => String(r.serverId));
      const dmChannelIds = dmRows.map((r) => String(r.channelId));

      const sessionId = crypto.randomUUID();

      client = {
        ws,
        sessionId,
        userId,
        seq: 0,
        subscribedChannels: new Set(),
        subscribedServers: new Set(),
      };

      // Store session in Redis
      const session: SessionState = {
        userId,
        username,
        sessionId,
        subscribedChannels: dmChannelIds,
        subscribedServers: serverIds,
        lastSeq: 0,
      };
      await setSession(redis, session);

      // Register with dispatcher
      dispatcher.register(client, dmChannelIds, serverIds);

      // Send Ready
      const readyData: GatewayReadyData = {
        sessionId,
        user: { id: userId, username },
        serverIds,
        dmChannelIds,
      };
      dispatcher.sendDispatch(client, "READY", readyData);

      // Start heartbeat monitor
      startHeartbeat();
    } catch {
      ws.close(4000, "Internal error");
    }
  }

  async function handleResume(data: { token: string; sessionId: string; seq: number }) {
    if (client) {
      return; // Already identified
    }

    let decoded: { sub: string; username: string };
    try {
      decoded = await verifyAccessToken(data.token);
    } catch {
      sendInvalidSession(false);
      return;
    }

    if (identifyTimeout) {
      clearTimeout(identifyTimeout);
      identifyTimeout = null;
    }

    try {
      const session = await getSession(redis, data.sessionId);
      if (!session || session.userId !== decoded.sub) {
        sendInvalidSession(false);
        return;
      }

      client = {
        ws,
        sessionId: data.sessionId,
        userId: decoded.sub,
        seq: Math.max(session.lastSeq, data.seq),
        subscribedChannels: new Set(),
        subscribedServers: new Set(),
      };

      // Re-register with dispatcher
      dispatcher.register(client, session.subscribedChannels, session.subscribedServers);

      // Replay missed events
      let replaySeq = data.seq;
      const missed = await getReplayEvents(redis, data.sessionId, data.seq);
      for (const payload of missed) {
        try {
          ws.send(payload);
          const parsed = JSON.parse(payload) as { s?: number };
          if (typeof parsed.s === "number" && parsed.s > replaySeq) {
            replaySeq = parsed.s;
          }
        } catch {
          break;
        }
      }
      client.seq = replaySeq;

      // Signal successful resume so clients can transition back to "connected".
      dispatcher.sendDispatch(client, "RESUMED", { sessionId: data.sessionId });

      // Start heartbeat monitor
      startHeartbeat();
    } catch {
      ws.close(4000, "Internal error");
    }
  }

  function handleHeartbeat() {
    if (!client) {
      return;
    }

    lastHeartbeatAck = true;
    ws.send(JSON.stringify({ op: GatewayOpcodes.HeartbeatAck }));

    // Refresh session TTL
    void refreshSessionTTL(redis, client.sessionId);
  }

  function startHeartbeat() {
    lastHeartbeatAck = true;
    heartbeatTimer = setInterval(() => {
      if (!lastHeartbeatAck) {
        ws.close(4009, "Heartbeat timeout");
        return;
      }
      lastHeartbeatAck = false;
    }, HEARTBEAT_INTERVAL * 1.5);
  }

  function sendInvalidSession(resumable: boolean) {
    ws.send(
      JSON.stringify({
        op: GatewayOpcodes.InvalidSession,
        d: { resumable },
      }),
    );
    ws.close(4006, "Invalid session");
  }

  function cleanup(deleteSessionData: boolean) {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
    if (identifyTimeout) {
      clearTimeout(identifyTimeout);
      identifyTimeout = null;
    }
    if (client) {
      dispatcher.unregister(client);
      if (deleteSessionData) {
        // Session stays in Redis for resume window (5 min TTL)
      }
      client = null;
    }
  }
}
