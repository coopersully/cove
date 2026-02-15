import type { Server } from "@hearth/api-client";
import { ResponsiveConfirmModal } from "@hearth/ui";
import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useLeaveServer } from "../../hooks/use-servers.js";

interface LeaveServerDialogProps {
  readonly server: Server;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function LeaveServerDialog({
  server,
  open,
  onOpenChange,
}: LeaveServerDialogProps): JSX.Element {
  const leaveServer = useLeaveServer();
  const navigate = useNavigate();

  async function handleConfirm() {
    await new Promise<void>((resolve, reject) => {
      leaveServer.mutate(server.id, {
        onSuccess: () => {
          onOpenChange(false);
          void navigate("/servers");
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
      title="Leave Server"
      description={
        <>
          Are you sure you want to leave <strong>{server.name}</strong>? You will need an invite to
          rejoin.
        </>
      }
      onConfirm={handleConfirm}
      confirmLabel="Leave Server"
      pendingLabel="Leaving..."
      variant="destructive"
    />
  );
}
