import { Button, Textarea, cn } from "@hearth/ui";
import { SendHorizontal } from "lucide-react";
import type { JSX, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { useSendMessage } from "../../hooks/use-messages.js";

interface MessageComposerProps {
  readonly channelId: string;
}

export function MessageComposer({ channelId }: MessageComposerProps): JSX.Element {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage(channelId);

  const handleSend = (): void => {
    const trimmed = content.trim();
    if (!trimmed || sendMessage.isPending) {
      return;
    }

    sendMessage.mutate({ content: trimmed });
    setContent("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (): void => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = "auto";
    const maxHeight = 4 * 24; // ~4 lines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  };

  const hasContent = content.trim().length > 0;

  return (
    <div className="relative z-10 border-border border-t px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl bg-secondary px-3 py-2 ring-1 ring-transparent transition-all focus-within:ring-primary/30">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleInput();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          maxLength={4000}
          className="max-h-24 min-h-0 flex-1 resize-none border-0 bg-transparent p-0 text-foreground text-sm shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleSend}
          disabled={!hasContent || sendMessage.isPending}
          className={cn(
            "shrink-0 rounded-full transition-all",
            hasContent
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
