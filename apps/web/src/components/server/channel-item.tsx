import type { Channel } from "@hearth/api-client";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  cn,
} from "@hearth/ui";
import { Hash, Pencil, Trash2, Volume2 } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { DeleteChannelDialog } from "./delete-channel-dialog.js";
import { EditChannelDialog } from "./edit-channel-dialog.js";

interface ChannelItemProps {
  readonly channel: Channel;
  readonly isOwner: boolean;
}

export function ChannelItem({ channel, isOwner }: ChannelItemProps): JSX.Element {
  const { channelId } = useParams();
  const isActive = channelId === channel.id;
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const link = (
    <Link
      to={`/servers/${channel.serverId}/channels/${channel.id}`}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-secondary font-medium text-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
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

  if (!isOwner) {
    return link;
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild={true}>{link}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => setEditOpen(true)}>
            <Pencil className="size-4" />
            Edit Channel
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Delete Channel
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <EditChannelDialog channel={channel} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteChannelDialog channel={channel} open={deleteOpen} onOpenChange={setDeleteOpen} />
    </>
  );
}
