import type { Server } from "@hearth/api-client";
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

  function handleLeave() {
    leaveServer.mutate(server.id, {
      onSuccess: () => {
        onOpenChange(false);
        void navigate("/servers");
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Server</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to leave <strong>{server.name}</strong>? You will need an invite to
            rejoin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleLeave}>
            Leave Server
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
