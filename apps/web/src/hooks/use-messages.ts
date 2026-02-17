import type {
  CreateMessageRequest,
  MessageListResponse,
  UpdateMessageRequest,
} from "@cove/api-client";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
import { useGatewayStore } from "../stores/gateway.js";

const MESSAGE_LIMIT = 50;

export function useMessages(channelId: string) {
  return useInfiniteQuery({
    queryKey: ["channels", channelId, "messages"],
    queryFn: ({ pageParam }) =>
      api.messages.list(channelId, {
        before: pageParam,
        limit: MESSAGE_LIMIT,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (lastPage.messages.length < MESSAGE_LIMIT) {
        return undefined;
      }
      const oldest = lastPage.messages.at(-1);
      return oldest?.id;
    },
  });
}

export function useSendMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMessageRequest) => api.messages.create(channelId, data),
    onMutate: async (data) => {
      const user = useAuthStore.getState().user;
      await queryClient.cancelQueries({
        queryKey: ["channels", channelId, "messages"],
      });

      const previous = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
        "channels",
        channelId,
        "messages",
      ]);

      if (previous && user) {
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["channels", channelId, "messages"],
          (old) => {
            if (!old) {
              return old;
            }
            const optimisticMessage = {
              id: `optimistic-${Date.now()}`,
              channelId,
              content: data.content,
              createdAt: new Date().toISOString(),
              editedAt: null,
              reactions: [],
              author: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
                statusEmoji: user.statusEmoji,
              },
            };

            const newPages = [...old.pages];
            const firstPage = newPages[0];
            if (firstPage) {
              newPages[0] = {
                ...firstPage,
                messages: [optimisticMessage, ...firstPage.messages],
              };
            }
            return { ...old, pages: newPages };
          },
        );
      }

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["channels", channelId, "messages"], context.previous);
      }
    },
    onSettled: () => {
      if (useGatewayStore.getState().status !== "connected") {
        void queryClient.invalidateQueries({
          queryKey: ["channels", channelId, "messages"],
        });
      }
    },
  });
}

export function useUpdateMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ messageId, data }: { messageId: string; data: UpdateMessageRequest }) =>
      api.messages.update(messageId, data),
    onMutate: async ({ messageId, data }) => {
      await queryClient.cancelQueries({
        queryKey: ["channels", channelId, "messages"],
      });

      const previous = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
        "channels",
        channelId,
        "messages",
      ]);

      if (previous) {
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["channels", channelId, "messages"],
          (old) => {
            if (!old) {
              return old;
            }
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, content: data.content, editedAt: new Date().toISOString() }
                    : msg,
                ),
              })),
            };
          },
        );
      }

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["channels", channelId, "messages"], context.previous);
      }
    },
    onSettled: () => {
      if (useGatewayStore.getState().status !== "connected") {
        void queryClient.invalidateQueries({
          queryKey: ["channels", channelId, "messages"],
        });
      }
    },
  });
}

export function useDeleteMessage(channelId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (messageId: string) => api.messages.delete(messageId),
    onMutate: async (messageId) => {
      await queryClient.cancelQueries({
        queryKey: ["channels", channelId, "messages"],
      });

      const previous = queryClient.getQueryData<InfiniteData<MessageListResponse>>([
        "channels",
        channelId,
        "messages",
      ]);

      if (previous) {
        queryClient.setQueryData<InfiniteData<MessageListResponse>>(
          ["channels", channelId, "messages"],
          (old) => {
            if (!old) {
              return old;
            }
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                messages: page.messages.filter((msg) => msg.id !== messageId),
              })),
            };
          },
        );
      }

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["channels", channelId, "messages"], context.previous);
      }
    },
    onSettled: () => {
      if (useGatewayStore.getState().status !== "connected") {
        void queryClient.invalidateQueries({
          queryKey: ["channels", channelId, "messages"],
        });
      }
    },
  });
}
