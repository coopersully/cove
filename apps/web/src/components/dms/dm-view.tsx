import type { JSX } from "react";
import { useParams } from "react-router";
import { useDm } from "../../hooks/use-dms.js";
import { useDocumentTitle } from "../../hooks/use-document-title.js";
import { useAuthStore } from "../../stores/auth.js";
import { UserAvatar } from "../user-avatar.js";
import { MessageComposer } from "../messages/message-composer.js";
import { MessageFeed } from "../messages/message-feed.js";
import { DmList } from "./dm-list.js";

export function DmView(): JSX.Element {
  const { channelId } = useParams();
  const currentUser = useAuthStore((s) => s.user);

  if (!channelId) {
    return (
      <>
        <DmList />
        <DmPlaceholder />
      </>
    );
  }

  return (
    <>
      <DmList />
      <DmConversation key={channelId} channelId={channelId} currentUserId={currentUser?.id} />
    </>
  );
}

function DmPlaceholder(): JSX.Element {
  useDocumentTitle("Direct Messages");
  return (
    <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground">
      <p className="font-body text-sm">Select a conversation or start a new one</p>
    </div>
  );
}

function DmConversation({
  channelId,
  currentUserId,
}: {
  channelId: string;
  currentUserId: string | undefined;
}): JSX.Element {
  const { data } = useDm(channelId);

  const recipient = currentUserId
    ? data?.members.find((m) => m.id !== currentUserId)
    : undefined;
  const recipientName = recipient?.displayName ?? recipient?.username ?? "User";
  useDocumentTitle(recipientName);

  return (
    <div className="relative flex flex-1 animate-fade-in flex-col bg-background">
      {/* Subtle grain overlay for warmth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Warm gradient near bottom */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-32"
        style={{
          background: "linear-gradient(to top, rgba(28,25,23,0.02) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex h-12 items-center gap-2 border-border border-b px-4">
        {recipient ? (
          <>
            <UserAvatar
              user={{
                id: recipient.id,
                avatarUrl: recipient.avatarUrl,
                displayName: recipient.displayName,
                username: recipient.username,
              }}
              size="sm"
            />
            <span className="font-semibold text-foreground text-sm">{recipientName}</span>
          </>
        ) : (
          <span className="font-semibold text-foreground text-sm">Direct Message</span>
        )}
      </div>
      <MessageFeed channelId={channelId} />
      <MessageComposer channelId={channelId} />
    </div>
  );
}
