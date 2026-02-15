import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  cn,
} from "@cove/ui";
import { ChevronDown, Hash, LogOut, Settings, Trash2, Volume2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useChannels } from "../../hooks/use-channels.js";
import { useServer } from "../../hooks/use-servers.js";
import { useAuthStore } from "../../stores/auth.js";
import { CreateChannelDialog } from "../server/create-channel-dialog.js";
import { DeleteServerDialog } from "../server/delete-server-dialog.js";
import { LeaveServerDialog } from "../server/leave-server-dialog.js";
import { ServerSettingsDialog } from "../server/server-settings-dialog.js";

interface MobileChannelPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly serverId: string;
}

export function MobileChannelPicker({
  open,
  onOpenChange,
  serverId,
}: MobileChannelPickerProps): JSX.Element {
  const { channelId } = useParams();
  const { data: channelData } = useChannels(serverId);
  const { data: serverData } = useServer(serverId);
  const user = useAuthStore((s) => s.user);
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
    <>
      <Drawer direction="left" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="p-0">
          <DrawerDescription className="sr-only">Select a channel</DrawerDescription>
          {/* Server header with dropdown */}
          <div className="flex items-center justify-between border-border border-b px-4 py-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild={true}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 transition-colors active:opacity-70"
                >
                  <DrawerTitle className="truncate font-display font-semibold text-foreground text-sm">
                    {server?.name ?? "Loading..."}
                  </DrawerTitle>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
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
          </div>

          {/* Channel list */}
          <div className="flex flex-1 flex-col overflow-y-auto p-2">
            {/* Text channels header */}
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                Text Channels
              </span>
              {isOwner && <CreateChannelDialog serverId={serverId} />}
            </div>
            {textChannels.map((channel) => {
              const isActive = channelId === channel.id;
              return (
                <DrawerClose key={channel.id} asChild={true}>
                  <Link
                    to={`/servers/${channel.serverId}/channels/${channel.id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors active:bg-secondary/50",
                      isActive
                        ? "bg-secondary font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    <Hash className="size-4 shrink-0 opacity-60" />
                    <span className="truncate">{channel.name}</span>
                  </Link>
                </DrawerClose>
              );
            })}

            {/* Voice channels */}
            {voiceChannels.length > 0 && (
              <>
                <Separator className="my-2" />
                <div className="px-1 pb-1">
                  <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                    Voice Channels
                  </span>
                </div>
                {voiceChannels.map((channel) => {
                  const isActive = channelId === channel.id;
                  return (
                    <DrawerClose key={channel.id} asChild={true}>
                      <Link
                        to={`/servers/${channel.serverId}/channels/${channel.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors active:bg-secondary/50",
                          isActive
                            ? "bg-secondary font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <Volume2 className="size-4 shrink-0 opacity-60" />
                        <span className="truncate">{channel.name}</span>
                      </Link>
                    </DrawerClose>
                  );
                })}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

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
    </>
  );
}
