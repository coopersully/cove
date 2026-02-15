import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ScrollArea,
  Separator,
  cn,
} from "@hearth/ui";
import { ChevronDown, LogOut, Settings, Trash2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useChannels } from "../../hooks/use-channels.js";
import { useServer } from "../../hooks/use-servers.js";
import { useAuthStore } from "../../stores/auth.js";
import { ChannelItem } from "./channel-item.js";
import { CreateChannelDialog } from "./create-channel-dialog.js";
import { DeleteServerDialog } from "./delete-server-dialog.js";
import { LeaveServerDialog } from "./leave-server-dialog.js";
import { ServerSettingsDialog } from "./server-settings-dialog.js";

interface ChannelListProps {
  readonly serverId: string;
}

export function ChannelList({ serverId }: ChannelListProps): JSX.Element {
  const { data: channelData } = useChannels(serverId);
  const { data: serverData } = useServer(serverId);
  const user = useAuthStore((s) => s.user);
  const [textCollapsed, setTextCollapsed] = useState(false);
  const [voiceCollapsed, setVoiceCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const channels = channelData?.channels ?? [];
  const server = serverData?.server;
  const isOwner = server?.ownerId === user?.id;

  const textChannels = channels
    .filter((c) => c.type === "text")
    .sort((a, b) => a.position - b.position);

  const voiceChannels = channels
    .filter((c) => c.type === "voice")
    .sort((a, b) => a.position - b.position);

  return (
    <div className="flex w-60 flex-col border-border border-r bg-card">
      {/* Server header with dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            className="flex h-12 w-full items-center justify-between border-border border-b px-4 transition-colors hover:bg-secondary/30"
          >
            <h2 className="truncate font-display font-semibold text-foreground text-sm">
              {server?.name ?? "Loading..."}
            </h2>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {isOwner && (
            <>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                <Settings className="size-4" />
                Server Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" />
                Delete Server
              </DropdownMenuItem>
            </>
          )}
          {!isOwner && (
            <DropdownMenuItem variant="destructive" onSelect={() => setLeaveOpen(true)}>
              <LogOut className="size-4" />
              Leave Server
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {/* Text Channels */}
          <div className="flex items-center justify-between px-1 pb-1">
            <button
              type="button"
              className="flex items-center gap-0.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide transition-colors hover:text-foreground"
              onClick={() => setTextCollapsed(!textCollapsed)}
            >
              <ChevronDown
                className={cn("size-3 transition-transform", textCollapsed && "-rotate-90")}
              />
              Text Channels
            </button>
            {isOwner && <CreateChannelDialog serverId={serverId} />}
          </div>
          {!textCollapsed &&
            textChannels.map((channel) => (
              <ChannelItem key={channel.id} channel={channel} isOwner={isOwner} />
            ))}

          {/* Voice Channels */}
          {voiceChannels.length > 0 && (
            <>
              <Separator className="my-2" />
              <div className="flex items-center justify-between px-1 pb-1">
                <button
                  type="button"
                  className="flex items-center gap-0.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide transition-colors hover:text-foreground"
                  onClick={() => setVoiceCollapsed(!voiceCollapsed)}
                >
                  <ChevronDown
                    className={cn("size-3 transition-transform", voiceCollapsed && "-rotate-90")}
                  />
                  Voice Channels
                </button>
              </div>
              {!voiceCollapsed &&
                voiceChannels.map((channel) => (
                  <ChannelItem key={channel.id} channel={channel} isOwner={isOwner} />
                ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Server management dialogs */}
      {server && isOwner && (
        <>
          <ServerSettingsDialog
            server={server}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
          />
          <DeleteServerDialog server={server} open={deleteOpen} onOpenChange={setDeleteOpen} />
        </>
      )}
      {server && !isOwner && (
        <LeaveServerDialog server={server} open={leaveOpen} onOpenChange={setLeaveOpen} />
      )}
    </div>
  );
}
