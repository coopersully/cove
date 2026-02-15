import type { Server } from "@hearth/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@hearth/ui";
import type { JSX } from "react";
import { useState } from "react";
import { useUpdateServer } from "../../hooks/use-servers.js";

interface ServerSettingsDialogProps {
  readonly server: Server;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function ServerSettingsDialog({
  server,
  open,
  onOpenChange,
}: ServerSettingsDialogProps): JSX.Element {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description ?? "");
  const updateServer = useUpdateServer(server.id);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    updateServer.mutate(
      {
        name: trimmedName,
        description: description.trim() || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Server Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-name">Server name</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="My Server"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="server-description">Description</Label>
            <Input
              id="server-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1024}
              placeholder="What is this server about?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || updateServer.isPending}>
              {updateServer.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
