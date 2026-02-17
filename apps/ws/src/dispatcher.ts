import type { WebSocket } from "ws";

import type Redis from "ioredis";

import { GatewayOpcodes } from "@cove/gateway";
import type { GatewayDispatch, GatewayRedisEvent } from "@cove/gateway";

import { pushReplayEvent } from "@cove/gateway";

export interface ClientSession {
  ws: WebSocket;
  sessionId: string;
  userId: string;
  seq: number;
  subscribedChannels: Set<string>;
  subscribedServers: Set<string>;
}

export class Dispatcher {
  private channelClients = new Map<string, Set<ClientSession>>();
  private serverClients = new Map<string, Set<ClientSession>>();
  private userClients = new Map<string, Set<ClientSession>>();

  constructor(private redis: Redis) {}

  register(client: ClientSession, channelIds: string[], serverIds: string[]): void {
    for (const channelId of channelIds) {
      let set = this.channelClients.get(channelId);
      if (!set) {
        set = new Set();
        this.channelClients.set(channelId, set);
      }
      set.add(client);
      client.subscribedChannels.add(channelId);
    }

    for (const serverId of serverIds) {
      let set = this.serverClients.get(serverId);
      if (!set) {
        set = new Set();
        this.serverClients.set(serverId, set);
      }
      set.add(client);
      client.subscribedServers.add(serverId);
    }

    let userSet = this.userClients.get(client.userId);
    if (!userSet) {
      userSet = new Set();
      this.userClients.set(client.userId, userSet);
    }
    userSet.add(client);
  }

  unregister(client: ClientSession): void {
    for (const channelId of client.subscribedChannels) {
      const set = this.channelClients.get(channelId);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.channelClients.delete(channelId);
        }
      }
    }

    for (const serverId of client.subscribedServers) {
      const set = this.serverClients.get(serverId);
      if (set) {
        set.delete(client);
        if (set.size === 0) {
          this.serverClients.delete(serverId);
        }
      }
    }

    const userSet = this.userClients.get(client.userId);
    if (userSet) {
      userSet.delete(client);
      if (userSet.size === 0) {
        this.userClients.delete(client.userId);
      }
    }
  }

  dispatch(event: GatewayRedisEvent): void {
    const targets = new Set<ClientSession>();

    if (event.targets.channelId) {
      const set = this.channelClients.get(event.targets.channelId);
      if (set) {
        for (const client of set) {
          targets.add(client);
        }
      }
    }

    if (event.targets.serverId) {
      const set = this.serverClients.get(event.targets.serverId);
      if (set) {
        for (const client of set) {
          targets.add(client);
        }
      }
    }

    if (event.targets.userIds) {
      for (const userId of event.targets.userIds) {
        const set = this.userClients.get(userId);
        if (set) {
          for (const client of set) {
            targets.add(client);
          }
        }
      }
    }

    for (const client of targets) {
      this.sendDispatch(client, event.event, event.data);
    }
  }

  sendDispatch(client: ClientSession, event: string, data: unknown): void {
    client.seq++;

    const payload: GatewayDispatch = {
      op: GatewayOpcodes.Dispatch,
      t: event as GatewayDispatch["t"],
      s: client.seq,
      d: data,
    };

    const serialized = JSON.stringify(payload);

    try {
      client.ws.send(serialized);
    } catch {
      // Client may have disconnected — ignore send errors
    }

    // Push to replay buffer (fire-and-forget).
    void pushReplayEvent(this.redis, client.sessionId, client.seq, serialized);
  }
}
