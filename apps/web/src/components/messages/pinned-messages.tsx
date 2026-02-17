import { Pin, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { usePins } from "../../hooks/use-pins.js";
import { UserAvatar } from "../user-avatar.js";
import { MarkdownContent } from "./markdown-content.js";

interface PinnedMessagesProps {
  readonly channelId: string;
}

export function PinnedMessages({ channelId }: PinnedMessagesProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const { data, status } = usePins(channelId);

  const pinCount = data?.messages.length ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-muted-foreground text-sm transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Pinned messages"
      >
        <Pin className="size-4" />
        {pinCount > 0 && <span>{pinCount}</span>}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-40 mt-1 w-96 rounded-lg border bg-card shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="font-semibold text-sm">Pinned Messages</h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto p-2">
            {status === "pending" && (
              <div className="p-4 text-center text-muted-foreground text-sm">Loading...</div>
            )}
            {status === "success" && data.messages.length === 0 && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No pinned messages yet.
              </div>
            )}
            {status === "success" &&
              data.messages.map((msg) => (
                <div key={msg.id} className="rounded-md p-3 hover:bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      user={{
                        id: msg.author.id,
                        avatarUrl: msg.author.avatarUrl,
                        displayName: msg.author.displayName,
                        username: msg.author.username,
                      }}
                      size="sm"
                    />
                    <span className="font-semibold text-sm">
                      {msg.author.displayName ?? msg.author.username}
                    </span>
                  </div>
                  <div className="mt-1 text-sm">
                    <MarkdownContent content={msg.content} />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
