import type { Message } from "@hearth/api-client";
import { Avatar, AvatarFallback, AvatarImage, ResponsiveConfirmModal, Textarea } from "@hearth/ui";
import { Pencil, Trash2 } from "lucide-react";
import type { JSX, KeyboardEvent } from "react";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import { useDeleteMessage, useUpdateMessage } from "../../hooks/use-messages.js";
import { useAuthStore } from "../../stores/auth.js";
import { MarkdownContent } from "./markdown-content.js";

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
  const { channelId } = useParams();
  const user = useAuthStore((s) => s.user);
  const isOwn = user?.id === message.author.id;

  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const updateMessage = useUpdateMessage(channelId ?? "");
  const deleteMessage = useDeleteMessage(channelId ?? "");

  const displayName = message.author.displayName ?? message.author.username;

  function startEditing() {
    setEditContent(message.content);
    setEditing(true);
    requestAnimationFrame(() => editRef.current?.focus());
  }

  function cancelEditing() {
    setEditing(false);
    setEditContent(message.content);
  }

  function saveEdit() {
    const trimmed = editContent.trim();
    if (!trimmed || trimmed === message.content) {
      cancelEditing();
      return;
    }
    updateMessage.mutate(
      { messageId: message.id, data: { content: trimmed } },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      cancelEditing();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  }

  async function confirmDelete() {
    await new Promise<void>((resolve, reject) => {
      deleteMessage.mutate(message.id, {
        onSuccess: () => {
          setDeleteOpen(false);
          resolve();
        },
        onError: reject,
      });
    });
  }

  const actionBar = isOwn && !editing && (
    <div className="-top-3 absolute right-2 hidden rounded-md border bg-card shadow-sm group-hover:flex">
      <button
        type="button"
        onClick={startEditing}
        className="p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Edit message"
      >
        <Pencil className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="p-1.5 text-muted-foreground transition-colors hover:text-destructive"
        aria-label="Delete message"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );

  const deleteDialog = (
    <ResponsiveConfirmModal
      open={deleteOpen}
      onOpenChange={setDeleteOpen}
      title="Delete Message"
      description="Are you sure you want to delete this message? This action cannot be undone."
      onConfirm={confirmDelete}
      confirmLabel="Delete"
      pendingLabel="Deleting..."
      variant="destructive"
    />
  );

  const contentOrEditor = editing ? (
    <div className="mt-1">
      <Textarea
        ref={editRef}
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        onKeyDown={handleEditKeyDown}
        className="min-h-[2.5rem] resize-none text-sm"
        rows={1}
      />
      <div className="mt-1 flex items-center gap-1 text-muted-foreground text-xs">
        <span>
          Escape to
          <button type="button" onClick={cancelEditing} className="text-foreground hover:underline">
            cancel
          </button>
          · Enter to
          <button type="button" onClick={saveEdit} className="text-foreground hover:underline">
            save
          </button>
        </span>
      </div>
    </div>
  ) : (
    <div className="break-words text-foreground/90 text-sm">
      <MarkdownContent content={message.content} />
    </div>
  );

  if (!showAuthor) {
    return (
      <div className="group relative py-0.5 pr-4 pl-[68px] transition-colors hover:bg-secondary/50">
        {actionBar}
        <span className="absolute left-0 flex h-5 w-[68px] items-center justify-center text-muted-foreground text-xs opacity-0 group-hover:opacity-100">
          {new Date(message.createdAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <div className="min-w-0">{contentOrEditor}</div>
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="group relative flex gap-3 py-1 pr-4 pl-4 transition-colors hover:bg-secondary/50">
      {actionBar}
      <Avatar className="mt-0.5 size-10 shrink-0">
        <AvatarImage src={message.author.avatarUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="bg-primary/20 text-primary text-xs">
          {getInitials(displayName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-foreground text-sm">{displayName}</span>
          <span className="text-muted-foreground text-xs">
            {formatTimestamp(message.createdAt)}
          </span>
          {message.editedAt && <span className="text-muted-foreground text-xs">(edited)</span>}
        </div>
        {contentOrEditor}
      </div>
      {deleteDialog}
    </div>
  );
}
