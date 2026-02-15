import type { Channel } from "@hearth/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@hearth/ui";
import type { JSX } from "react";
import { useNavigate, useParams } from "react-router";
import { useDeleteChannel } from "../../hooks/use-channels.js";

interface DeleteChannelDialogProps {
  readonly channel: Channel;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DeleteChannelDialog({
  channel,
  open,
  onOpenChange,
}: DeleteChannelDialogProps): JSX.Element {
  const deleteChannel = useDeleteChannel(channel.serverId);
  const navigate = useNavigate();
  const { channelId } = useParams();

  function handleDelete() {
    deleteChannel.mutate(channel.id, {
      onSuccess: () => {
        onOpenChange(false);
        if (channelId === channel.id) {
          void navigate(`/servers/${channel.serverId}`);
        }
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Channel</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>#{channel.name}</strong> and all of its messages.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Delete Channel
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
