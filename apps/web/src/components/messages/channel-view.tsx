import { Hash } from "lucide-react";
import type { JSX } from "react";
import { MessageComposer } from "./message-composer.js";
import { MessageFeed } from "./message-feed.js";

interface ChannelViewProps {
  readonly channelId: string;
}

export function ChannelView({ channelId }: ChannelViewProps): JSX.Element {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex h-12 items-center gap-2 border-elevated border-b px-4">
        <Hash className="size-4 text-driftwood" />
        <span className="font-semibold text-linen text-sm">channel</span>
      </div>
      <MessageFeed channelId={channelId} />
      <MessageComposer channelId={channelId} />
    </div>
  );
}
