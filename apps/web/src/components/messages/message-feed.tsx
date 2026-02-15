import type { Message } from "@cove/api-client";
import type { JSX } from "react";
import { useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { useMessages } from "../../hooks/use-messages.js";
import { Logo } from "../logo.js";
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

function MessageSkeleton({ showAuthor }: { readonly showAuthor: boolean }): JSX.Element {
  if (!showAuthor) {
    return (
      <div className="flex gap-4 py-0.5 pr-4 pl-[68px]">
        <div className="skeleton h-3 w-3/4 rounded" />
      </div>
    );
  }
  return (
    <div className="flex gap-3 py-2 pr-4 pl-4">
      <div className="skeleton mt-0.5 size-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <div className="skeleton h-3 w-24 rounded" />
          <div className="skeleton h-2 w-12 rounded" />
        </div>
        <div className="skeleton h-3 w-5/6 rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
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
      <div className="relative z-10 flex flex-1 flex-col gap-1 py-4">
        <MessageSkeleton showAuthor={true} />
        <MessageSkeleton showAuthor={false} />
        <MessageSkeleton showAuthor={false} />
        <MessageSkeleton showAuthor={true} />
        <MessageSkeleton showAuthor={false} />
        <MessageSkeleton showAuthor={true} />
        <MessageSkeleton showAuthor={false} />
        <MessageSkeleton showAuthor={false} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="relative z-10 flex flex-1 items-center justify-center text-destructive">
        Failed to load messages
      </div>
    );
  }

  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-y-auto">
      {/* Load more sentinel */}
      <div ref={loadMoreRef} className="shrink-0 px-4 py-2">
        {isFetchingNextPage && (
          <div className="flex justify-center">
            <div className="size-4 animate-cove-ember rounded-full bg-primary/80" />
          </div>
        )}
        {!hasNextPage && allMessages.length > 0 && (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10">
              <Logo className="size-5 text-primary" />
            </div>
            <p className="font-display font-semibold text-foreground text-sm">
              The beginning of the conversation
            </p>
            <p className="mt-1 text-muted-foreground text-xs">This is where it all started.</p>
          </div>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Logo className="size-6 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-display font-semibold text-foreground text-sm">No messages yet</p>
            <p className="mt-1 text-sm">Start the conversation!</p>
          </div>
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
