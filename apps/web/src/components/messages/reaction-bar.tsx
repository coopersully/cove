import type { Reaction } from "@cove/api-client";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useParams } from "react-router";
import { useAddReaction, useRemoveReaction } from "../../hooks/use-reactions.js";

interface ReactionBarProps {
  readonly messageId: string;
  readonly reactions: readonly Reaction[];
  readonly onOpenPicker: () => void;
}

export function ReactionBar({
  messageId,
  reactions,
  onOpenPicker,
}: ReactionBarProps): JSX.Element | null {
  const { channelId } = useParams();
  const addReaction = useAddReaction(channelId ?? "");
  const removeReaction = useRemoveReaction(channelId ?? "");

  if (reactions.length === 0) {
    return null;
  }

  function toggleReaction(emoji: string, alreadyReacted: boolean) {
    if (alreadyReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => toggleReaction(r.emoji, r.me)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
            r.me
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onOpenPicker}
        className="inline-flex items-center rounded-full border border-border bg-secondary px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground"
        aria-label="Add reaction"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
