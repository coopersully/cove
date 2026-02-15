import type { MessageListResponse, User, UserProfileResponse } from "@cove/api-client";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Propagates a user profile change across all caches that contain user data.
 * Call this whenever user profile fields change (profile edit, avatar upload, etc.)
 * to ensure immediate UI updates everywhere.
 */
export function propagateUserUpdate(user: User): void {
  const authorFields = {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    statusEmoji: user.statusEmoji,
  };

  // 1. Patch author data in all cached message pages
  queryClient.setQueriesData<InfiniteData<MessageListResponse>>(
    { queryKey: ["channels"] },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.map((msg) =>
            msg.author.id === user.id ? { ...msg, author: { ...msg.author, ...authorFields } } : msg,
          ),
        })),
      };
    },
  );

  // 2. Update the user profile query cache (used by ProfileCard popover)
  queryClient.setQueryData<UserProfileResponse>(["users", user.id], (old) => {
    if (!old) return old;
    return { user: { ...old.user, ...user } };
  });
}
