import Redis from "ioredis";

import type { GatewayRedisEvent, SessionState } from "./types.js";

const EVENTS_CHANNEL = "cove:gateway:events";
const SESSION_PREFIX = "cove:session:";
const REPLAY_PREFIX = "cove:replay:";
const SESSION_TTL = 300; // 5 minutes
const REPLAY_MAX_LENGTH = 500;

function getRedisUrl(): string {
  return process.env.REDIS_URL ?? "redis://localhost:6380";
}

export function createRedisClient(): Redis {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 });
}

export function createRedisPublisher(): Redis {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 });
}

export function createRedisSubscriber(): Redis {
  return new Redis(getRedisUrl(), { maxRetriesPerRequest: 3 });
}

// ── Pub/Sub ──────────────────────────────────────────

export async function publishEvent(publisher: Redis, event: GatewayRedisEvent): Promise<void> {
  await publisher.publish(EVENTS_CHANNEL, JSON.stringify(event));
}

export async function subscribeToEvents(
  subscriber: Redis,
  handler: (event: GatewayRedisEvent) => void,
): Promise<void> {
  await subscriber.subscribe(EVENTS_CHANNEL);
  subscriber.on("message", (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as GatewayRedisEvent;
      handler(event);
    } catch {
      console.error("[gateway] Failed to parse Redis event:", message);
    }
  });
}

// ── Session State ────────────────────────────────────

export async function setSession(client: Redis, session: SessionState): Promise<void> {
  await client.set(
    `${SESSION_PREFIX}${session.sessionId}`,
    JSON.stringify(session),
    "EX",
    SESSION_TTL,
  );
}

export async function getSession(client: Redis, sessionId: string): Promise<SessionState | null> {
  const data = await client.get(`${SESSION_PREFIX}${sessionId}`);
  if (!data) {
    return null;
  }
  return JSON.parse(data) as SessionState;
}

export async function refreshSessionTTL(client: Redis, sessionId: string): Promise<void> {
  await client.expire(`${SESSION_PREFIX}${sessionId}`, SESSION_TTL);
}

export async function deleteSession(client: Redis, sessionId: string): Promise<void> {
  await client.del(`${SESSION_PREFIX}${sessionId}`);
}

// ── Replay Buffer ────────────────────────────────────

interface ReplayEntry {
  seq: number;
  payload: string;
}

export async function pushReplayEvent(
  client: Redis,
  sessionId: string,
  seq: number,
  payload: string,
): Promise<void> {
  const key = `${REPLAY_PREFIX}${sessionId}`;
  const entry: ReplayEntry = { seq, payload };
  await client.rpush(key, JSON.stringify(entry));
  await client.ltrim(key, -REPLAY_MAX_LENGTH, -1);
  await client.expire(key, SESSION_TTL);
}

export async function getReplayEvents(
  client: Redis,
  sessionId: string,
  afterSeq: number,
): Promise<string[]> {
  const key = `${REPLAY_PREFIX}${sessionId}`;
  const entries = await client.lrange(key, 0, -1);

  const results: string[] = [];
  for (const raw of entries) {
    const entry = JSON.parse(raw) as ReplayEntry;
    if (entry.seq > afterSeq) {
      results.push(entry.payload);
    }
  }
  return results;
}
