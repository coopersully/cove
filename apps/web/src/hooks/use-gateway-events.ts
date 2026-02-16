import type { Message, MessageListResponse } from "@cove/api-client";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useGatewayStore } from "../stores/gateway.js";
import { useTypingStore } from "../stores/typing.js";
import { useAuthStore } from "../stores/auth.js";

export function useGatewayEventRouter(): void {
	const client = useGatewayStore((s) => s.client);
	const queryClient = useQueryClient();
	const addTyping = useTypingStore((s) => s.addTyping);

	useEffect(() => {
		if (!client) return;

		const unsub = client.onEvent((event, data) => {
			switch (event) {
				case "MESSAGE_CREATE":
					handleMessageCreate(data as Message);
					break;
				case "MESSAGE_UPDATE":
					handleMessageUpdate(data as Partial<Message> & { id: string; channelId: string });
					break;
				case "MESSAGE_DELETE":
					handleMessageDelete(data as { id: string; channelId: string });
					break;
				case "CHANNEL_CREATE":
				case "CHANNEL_UPDATE":
				case "CHANNEL_DELETE":
					handleChannelChange(data as { serverId?: string });
					break;
				case "TYPING_START":
					handleTypingStart(data as { channelId: string; userId: string; username: string });
					break;
			}
		});

		return unsub;

		function handleMessageCreate(message: Message) {
			const currentUserId = useAuthStore.getState().user?.id;

			queryClient.setQueryData<InfiniteData<MessageListResponse>>(
				["channels", message.channelId, "messages"],
				(old) => {
					if (!old) return old;

					const newPages = [...old.pages];
					const firstPage = newPages[0];
					if (!firstPage) return old;

					// Reconcile optimistic message: same author + content
					if (message.author.id === currentUserId) {
						const optimisticIdx = firstPage.messages.findIndex(
							(m) =>
								m.id.startsWith("optimistic-") &&
								m.author.id === message.author.id &&
								m.content === message.content,
						);

						if (optimisticIdx !== -1) {
							const updatedMessages = [...firstPage.messages];
							updatedMessages[optimisticIdx] = message;
							newPages[0] = { ...firstPage, messages: updatedMessages };
							return { ...old, pages: newPages };
						}
					}

					// New message from another user — prepend
					newPages[0] = {
						...firstPage,
						messages: [message, ...firstPage.messages],
					};
					return { ...old, pages: newPages };
				},
			);
		}

		function handleMessageUpdate(data: Partial<Message> & { id: string; channelId: string }) {
			queryClient.setQueryData<InfiniteData<MessageListResponse>>(
				["channels", data.channelId, "messages"],
				(old) => {
					if (!old) return old;
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							messages: page.messages.map((msg) =>
								msg.id === data.id ? { ...msg, ...data } : msg,
							),
						})),
					};
				},
			);
		}

		function handleMessageDelete(data: { id: string; channelId: string }) {
			queryClient.setQueryData<InfiniteData<MessageListResponse>>(
				["channels", data.channelId, "messages"],
				(old) => {
					if (!old) return old;
					return {
						...old,
						pages: old.pages.map((page) => ({
							...page,
							messages: page.messages.filter((msg) => msg.id !== data.id),
						})),
					};
				},
			);
		}

		function handleChannelChange(data: { serverId?: string }) {
			if (data.serverId) {
				void queryClient.invalidateQueries({
					queryKey: ["servers", data.serverId, "channels"],
				});
			}
		}

		function handleTypingStart(data: { channelId: string; userId: string; username: string }) {
			const currentUserId = useAuthStore.getState().user?.id;
			if (data.userId === currentUserId) return; // Don't show own typing
			addTyping(data.channelId, data.userId, data.username);
		}
	}, [client, queryClient, addTyping]);
}
