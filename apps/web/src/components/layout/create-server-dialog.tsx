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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hearth/ui";
import { Plus } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateServer } from "../../hooks/use-servers.js";

export function CreateServerDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const createServer = useCreateServer();

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const result = await createServer.mutateAsync({
      name,
      description: description || undefined,
    });
    setName("");
    setDescription("");
    setOpen(false);
    void navigate(`/servers/${result.server.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Create server"
          >
            <Plus className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Create Server
        </TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a server</DialogTitle>
          <DialogDescription>
            Give your server a name and start building your community.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e: FormEvent) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="server-name">Server name</Label>
            <Input
              id="server-name"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="My awesome server"
              maxLength={100}
              required={true}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="server-description">Description (optional)</Label>
            <Input
              id="server-description"
              value={description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
              placeholder="What's your server about?"
              maxLength={1024}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createServer.isPending || !name.trim()}>
              {createServer.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
