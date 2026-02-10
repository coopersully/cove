import { ScrollArea } from "@hearth/ui";
import type { JSX } from "react";
import { useChannels } from "../../hooks/use-channels.js";
import { useServer } from "../../hooks/use-servers.js";
import { useAuthStore } from "../../stores/auth.js";
import { ChannelItem } from "./channel-item.js";
import { CreateChannelDialog } from "./create-channel-dialog.js";

interface ChannelListProps {
  readonly serverId: string;
}

export function ChannelList({ serverId }: ChannelListProps): JSX.Element {
  const { data: channelData } = useChannels(serverId);
  const { data: serverData } = useServer(serverId);
  const user = useAuthStore((s) => s.user);

  const channels = channelData?.channels ?? [];
  const server = serverData?.server;
  const isOwner = server?.ownerId === user?.id;

  return (
    <div className="flex w-60 flex-col border-elevated border-r bg-card">
      <div className="flex h-12 items-center justify-between border-elevated border-b px-4">
        <h2 className="truncate font-semibold text-linen text-sm">
          {server?.name ?? "Loading..."}
        </h2>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="font-semibold text-driftwood text-xs uppercase tracking-wide">
              Text Channels
            </span>
            {isOwner && <CreateChannelDialog serverId={serverId} />}
          </div>
          {channels
            .filter((c) => c.type === "text")
            .sort((a, b) => a.position - b.position)
            .map((channel) => (
              <ChannelItem key={channel.id} channel={channel} />
            ))}
          {channels.some((c) => c.type === "voice") && (
            <>
              <div className="mt-4 flex items-center justify-between px-1 pb-1">
                <span className="font-semibold text-driftwood text-xs uppercase tracking-wide">
                  Voice Channels
                </span>
              </div>
              {channels
                .filter((c) => c.type === "voice")
                .sort((a, b) => a.position - b.position)
                .map((channel) => (
                  <ChannelItem key={channel.id} channel={channel} />
                ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
