import { Hash } from "lucide-react";
import type { JSX } from "react";
import { MessageComposer } from "./message-composer.js";
import { MessageFeed } from "./message-feed.js";

interface ChannelViewProps {
  readonly channelId: string;
  readonly channelName?: string | undefined;
}

export function ChannelView({ channelId, channelName }: ChannelViewProps): JSX.Element {
  return (
    <div className="relative flex flex-1 animate-fade-in flex-col">
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
          background: "linear-gradient(to top, rgba(232,118,75,0.03) 0%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex h-12 items-center gap-2 border-border border-b px-4">
        <Hash className="size-4 text-muted-foreground" />
        <span className="font-semibold text-foreground text-sm">{channelName ?? "channel"}</span>
      </div>
      <MessageFeed channelId={channelId} />
      <MessageComposer channelId={channelId} />
    </div>
  );
}
