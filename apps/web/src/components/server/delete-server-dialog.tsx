import type { Server } from "@hearth/api-client";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
} from "@hearth/ui";
import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useDeleteServer } from "../../hooks/use-servers.js";

interface DeleteServerDialogProps {
  readonly server: Server;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function DeleteServerDialog({
  server,
  open,
  onOpenChange,
}: DeleteServerDialogProps): JSX.Element {
  const [confirmation, setConfirmation] = useState("");
  const deleteServer = useDeleteServer();
  const navigate = useNavigate();

  const canDelete = confirmation === server.name;

  function handleDelete() {
    if (!canDelete) {
      return;
    }
    deleteServer.mutate(server.id, {
      onSuccess: () => {
        onOpenChange(false);
        setConfirmation("");
        void navigate("/servers");
      },
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setConfirmation("");
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Server</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{server.name}</strong> and all of its channels and
            messages. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-server-name">
            Type <strong>{server.name}</strong> to confirm
          </Label>
          <Input
            id="confirm-server-name"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder={server.name}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || deleteServer.isPending}
          >
            {deleteServer.isPending ? "Deleting..." : "Delete Server"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
