import type { Channel } from "@hearth/api-client";
import { cn } from "@hearth/ui";
import { Hash, Volume2 } from "lucide-react";
import type { JSX } from "react";
import { Link, useParams } from "react-router";

interface ChannelItemProps {
  readonly channel: Channel;
}

export function ChannelItem({ channel }: ChannelItemProps): JSX.Element {
  const { channelId } = useParams();
  const isActive = channelId === channel.id;

  return (
    <Link
      to={`/servers/${channel.serverId}/channels/${channel.id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-elevated text-linen"
          : "text-driftwood hover:bg-elevated/50 hover:text-linen",
      )}
    >
      {channel.type === "text" ? (
        <Hash className="size-4 shrink-0 opacity-60" />
      ) : (
        <Volume2 className="size-4 shrink-0 opacity-60" />
      )}
      <span className="truncate">{channel.name}</span>
    </Link>
  );
}
