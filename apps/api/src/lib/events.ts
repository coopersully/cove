import { GatewayEvents, createRedisPublisher, publishEvent } from "@cove/gateway";
import type { GatewayRedisEvent } from "@cove/gateway";
import type { Redis } from "ioredis";

let publisher: Redis | undefined;

function getPublisher(): Redis {
	publisher ??= createRedisPublisher();
	return publisher;
}

async function emit(event: GatewayRedisEvent): Promise<void> {
	try {
		await publishEvent(getPublisher(), event);
	} catch (err) {
		console.error("[events] Failed to publish event:", err);
	}
}

export function emitMessageCreate(channelId: string, message: unknown): void {
	void emit({
		event: GatewayEvents.MessageCreate,
		data: message,
		targets: { channelId },
	});
}

export function emitMessageUpdate(channelId: string, message: unknown): void {
	void emit({
		event: GatewayEvents.MessageUpdate,
		data: message,
		targets: { channelId },
	});
}

export function emitMessageDelete(channelId: string, messageId: string): void {
	void emit({
		event: GatewayEvents.MessageDelete,
		data: { id: messageId, channelId },
		targets: { channelId },
	});
}

export function emitChannelCreate(serverId: string, channel: unknown): void {
	void emit({
		event: GatewayEvents.ChannelCreate,
		data: channel,
		targets: { serverId },
	});
}

export function emitChannelUpdate(serverId: string, channel: unknown): void {
	void emit({
		event: GatewayEvents.ChannelUpdate,
		data: channel,
		targets: { serverId },
	});
}

export function emitChannelDelete(serverId: string, channelId: string): void {
	void emit({
		event: GatewayEvents.ChannelDelete,
		data: { id: channelId, serverId },
		targets: { serverId },
	});
}

export function emitTypingStart(channelId: string, userId: string, username: string): void {
	void emit({
		event: GatewayEvents.TypingStart,
		data: { channelId, userId, username },
		targets: { channelId },
	});
}
