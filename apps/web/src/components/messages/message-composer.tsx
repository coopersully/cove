import { Button } from "@hearth/ui";
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

  return (
    <div className="border-elevated border-t px-4 py-3">
      <div className="flex items-end gap-2 rounded-lg bg-elevated px-3 py-2">
        <textarea
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
          className="max-h-24 flex-1 resize-none bg-transparent text-linen text-sm placeholder:text-driftwood focus:outline-none"
        />
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={handleSend}
          disabled={!content.trim() || sendMessage.isPending}
          className="shrink-0 text-driftwood hover:text-ember"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
