import type { MessageListResponse } from "@cove/api-client";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useReadStates } from "./use-read-states.js";

export function useUnreadCount(channelId: string): { hasUnread: boolean } {
	const { data: readStateData } = useReadStates();
	const queryClient = useQueryClient();

	const readState = readStateData?.readStates.find((rs) => rs.channelId === channelId);
	const lastReadId = readState?.lastReadMessageId;

	// Get latest message from cache
	const messagesData = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
		"channels",
		channelId,
		"messages",
	]);

	const latestMessage = messagesData?.pages[0]?.messages[0];

	if (!latestMessage || !lastReadId) {
		// If no read state, treat as unread if there are messages
		return { hasUnread: !!latestMessage && !lastReadId };
	}

	// Compare snowflake IDs numerically
	return { hasUnread: BigInt(latestMessage.id) > BigInt(lastReadId) };
}

export function useServerUnread(channelIds: string[]): boolean {
	const { data: readStateData } = useReadStates();
	const queryClient = useQueryClient();

	if (!readStateData) return false;

	for (const channelId of channelIds) {
		const readState = readStateData.readStates.find((rs) => rs.channelId === channelId);
		const lastReadId = readState?.lastReadMessageId;

		const messagesData = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
			"channels",
			channelId,
			"messages",
		]);

		const latestMessage = messagesData?.pages[0]?.messages[0];

		if (latestMessage && (!lastReadId || BigInt(latestMessage.id) > BigInt(lastReadId))) {
			return true;
		}
	}

	return false;
}
