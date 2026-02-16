import type { GatewayEvent } from "./events.js";
import type { GatewayOpcode } from "./opcodes.js";

// ── Client → Server payloads ─────────────────────────

export interface GatewayIdentify {
	op: 2;
	d: {
		token: string;
	};
}

export interface GatewayHeartbeat {
	op: 1;
	d: {
		seq: number | null;
	};
}

export interface GatewayResume {
	op: 4;
	d: {
		token: string;
		sessionId: string;
		seq: number;
	};
}

export type ClientPayload = GatewayIdentify | GatewayHeartbeat | GatewayResume;

// ── Server → Client payloads ─────────────────────────

export interface GatewayDispatch {
	op: 0;
	t: GatewayEvent;
	s: number;
	d: unknown;
}

export interface GatewayHello {
	op: 7;
	d: {
		heartbeatInterval: number;
	};
}

export interface GatewayHeartbeatAck {
	op: 3;
}

export interface GatewayReconnect {
	op: 5;
}

export interface GatewayInvalidSession {
	op: 6;
	d: {
		resumable: boolean;
	};
}

export type ServerPayload =
	| GatewayDispatch
	| GatewayHello
	| GatewayHeartbeatAck
	| GatewayReconnect
	| GatewayInvalidSession;

// ── Ready event data ─────────────────────────────────

export interface GatewayReadyData {
	sessionId: string;
	user: {
		id: string;
		username: string;
	};
	serverIds: string[];
	dmChannelIds: string[];
}

// ── Redis event envelope ─────────────────────────────

export interface GatewayRedisEvent {
	event: GatewayEvent;
	data: unknown;
	targets: {
		channelId?: string;
		serverId?: string;
		userIds?: string[];
	};
}

// ── Session state (stored in Redis) ──────────────────

export interface SessionState {
	userId: string;
	username: string;
	sessionId: string;
	subscribedChannels: string[];
	subscribedServers: string[];
	lastSeq: number;
}

// ── Generic gateway message (for parsing) ────────────

export interface GatewayMessage {
	op: GatewayOpcode;
	d?: unknown;
	t?: string;
	s?: number;
}
