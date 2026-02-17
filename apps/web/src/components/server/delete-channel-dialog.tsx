import type { Channel } from "@cove/api-client";
import { ResponsiveConfirmModal } from "@cove/ui";
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
  const serverId = channel.serverId ?? "";
  const deleteChannel = useDeleteChannel(serverId);
  const navigate = useNavigate();
  const { channelId } = useParams();

  if (!serverId) {
    throw new Error("DeleteChannelDialog requires a server channel");
  }

  async function handleConfirm() {
    await new Promise<void>((resolve, reject) => {
      deleteChannel.mutate(channel.id, {
        onSuccess: () => {
          onOpenChange(false);
          if (channelId === channel.id) {
            void navigate(`/servers/${serverId}`);
          }
          resolve();
        },
        onError: reject,
      });
    });
  }

  return (
    <ResponsiveConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Channel"
      description={
        <>
          This will permanently delete <strong>#{channel.name}</strong> and all of its messages.
          This action cannot be undone.
        </>
      }
      onConfirm={handleConfirm}
      confirmLabel="Delete Channel"
      pendingLabel="Deleting..."
      variant="destructive"
    />
  );
}
