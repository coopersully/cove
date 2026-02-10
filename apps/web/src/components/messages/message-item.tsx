import type { Message } from "@hearth/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@hearth/ui";
import type { JSX } from "react";

interface MessageItemProps {
  readonly message: Message;
  readonly showAuthor: boolean;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);

  if (diffMins < 1) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function MessageItem({ message, showAuthor }: MessageItemProps): JSX.Element {
  const displayName = message.author.displayName ?? message.author.username;

  if (!showAuthor) {
    return (
      <div className="group flex gap-4 py-0.5 pr-4 pl-[68px] hover:bg-elevated/30">
        <span className="invisible text-driftwood text-xs group-hover:visible">
          {new Date(message.createdAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <p className="break-words text-linen/90 text-sm">{message.content}</p>
      </div>
    );
  }

  return (
    <div className="group flex gap-3 py-1 pr-4 pl-4 hover:bg-elevated/30">
      <Avatar className="mt-0.5 size-10 shrink-0">
        <AvatarImage src={message.author.avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="bg-ember/20 text-ember text-xs">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-linen text-sm">{displayName}</span>
          <span className="text-driftwood text-xs">{formatTimestamp(message.createdAt)}</span>
          {message.editedAt && <span className="text-driftwood text-xs">(edited)</span>}
        </div>
        <p className="break-words text-linen/90 text-sm">{message.content}</p>
      </div>
    </div>
  );
}
