import type { Message } from "@hearth/api-client";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { useMessages } from "../../hooks/use-messages.js";
import { MessageItem } from "./message-item.js";

interface MessageFeedProps {
  readonly channelId: string;
}

function shouldShowAuthor(current: Message, previous: Message | undefined): boolean {
  if (!previous) {
    return true;
  }
  if (current.author.id !== previous.author.id) {
    return true;
  }

  const currentTime = new Date(current.createdAt).getTime();
  const previousTime = new Date(previous.createdAt).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  return currentTime - previousTime > fiveMinutes;
}

export function MessageFeed({ channelId }: MessageFeedProps): JSX.Element {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } = useMessages(channelId);

  const bottomRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);

  const { ref: loadMoreRef } = useInView({
    onChange: (inView) => {
      if (inView && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    },
  });

  // Flatten and reverse: API returns newest first, we render oldest first
  const allMessages = data?.pages.flatMap((page) => page.messages).reverse() ?? [];

  // Scroll to bottom on initial load
  useEffect(() => {
    if (isInitialLoad.current && allMessages.length > 0) {
      bottomRef.current?.scrollIntoView();
      isInitialLoad.current = false;
    }
  }, [allMessages.length]);

  // Reset initial load flag when channel changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: channelId change should reset load state
  useEffect(() => {
    isInitialLoad.current = true;
  }, [channelId]);

  if (status === "pending") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-ember border-t-transparent" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-1 items-center justify-center text-rose">
        Failed to load messages
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      {/* Load more sentinel */}
      <div ref={loadMoreRef} className="shrink-0 px-4 py-2">
        {isFetchingNextPage && (
          <div className="flex justify-center">
            <div className="size-4 animate-spin rounded-full border-2 border-ember border-t-transparent" />
          </div>
        )}
        {!hasNextPage && allMessages.length > 0 && (
          <p className="text-center text-driftwood text-xs">
            This is the beginning of the conversation
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex flex-col">
        {allMessages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            showAuthor={shouldShowAuthor(message, allMessages[index - 1])}
          />
        ))}
      </div>

      {allMessages.length === 0 && (
        <div className="flex flex-1 items-center justify-center text-driftwood">
          <p>No messages yet. Start the conversation!</p>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
