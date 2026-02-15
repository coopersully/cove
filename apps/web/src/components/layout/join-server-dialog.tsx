import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@hearth/ui";
import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useJoinServer } from "../../hooks/use-servers.js";

interface JoinServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function JoinServerDialog({ open, onOpenChange }: JoinServerDialogProps): JSX.Element {
  const [serverId, setServerId] = useState("");
  const joinServer = useJoinServer();
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = serverId.trim();
    if (!trimmed) return;

    joinServer.mutate(
      { serverId: trimmed },
      {
        onSuccess: () => {
          onOpenChange(false);
          setServerId("");
          void navigate(`/servers/${trimmed}`);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Server</DialogTitle>
          <DialogDescription>Enter a server ID or invite code to join a server.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="server-id">Server ID</Label>
            <Input
              id="server-id"
              value={serverId}
              onChange={(e) => setServerId(e.target.value)}
              placeholder="Enter server ID"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!serverId.trim() || joinServer.isPending}>
              {joinServer.isPending ? "Joining..." : "Join Server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
