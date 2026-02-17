import { Button, Textarea } from "@cove/ui";
import { ArrowUp, Eye, EyeOff } from "lucide-react";
import type { JSX, KeyboardEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useSendMessage } from "../../hooks/use-messages.js";
import { MarkdownContent } from "./markdown-content.js";

interface MessageComposerProps {
  readonly channelId: string;
}

const MARKDOWN_PATTERN = /[*_~`[#>]|\d+\./;

export function MessageComposer({ channelId }: MessageComposerProps): JSX.Element {
  const [content, setContent] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useSendMessage(channelId);

  const hasMarkdown = useMemo(() => MARKDOWN_PATTERN.test(content), [content]);
  const showPreview = previewOpen && hasMarkdown && content.trim().length > 0;

  const handleSend = (): void => {
    const trimmed = content.trim();
    if (!trimmed || sendMessage.isPending) {
      return;
    }

    sendMessage.mutate({ content: trimmed });
    setContent("");
    setPreviewOpen(false);

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
      <div className="flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 ring-1 ring-transparent transition-all focus-within:ring-primary/30">
        {showPreview ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setPreviewOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                setPreviewOpen(false);
              }
            }}
            className="max-h-24 min-h-5 flex-1 cursor-text overflow-y-auto text-foreground text-sm leading-5"
          >
            <MarkdownContent content={content.trim()} />
          </div>
        ) : (
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
            className="max-h-24 min-h-5 flex-1 resize-none border-0 bg-transparent p-0 text-foreground text-sm leading-5 shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
        )}
        {hasMarkdown && hasContent && (
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            className="shrink-0 self-start p-1 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={previewOpen ? "Edit message" : "Preview markdown"}
          >
            {previewOpen ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
        <Button
          size="icon-sm"
          onClick={handleSend}
          disabled={!hasContent || sendMessage.isPending}
          className="shrink-0 self-start rounded-full"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </div>
  );
}
