import type { Server } from "@hearth/api-client";
import { Input, Label, ResponsiveConfirmModal } from "@hearth/ui";
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

  function handleOpenChange(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setConfirmation("");
    }
  }

  async function handleConfirm() {
    if (!canDelete) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      deleteServer.mutate(server.id, {
        onSuccess: () => {
          handleOpenChange(false);
          setConfirmation("");
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
      onOpenChange={handleOpenChange}
      title="Delete Server"
      description={
        <>
          This will permanently delete <strong>{server.name}</strong> and all of its channels and
          messages. This action cannot be undone.
        </>
      }
      onConfirm={handleConfirm}
      confirmLabel="Delete Server"
      pendingLabel="Deleting..."
      variant="destructive"
      disabled={!canDelete}
    >
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
    </ResponsiveConfirmModal>
  );
}
