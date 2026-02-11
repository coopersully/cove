import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "@hearth/ui";
import { Plus } from "lucide-react";
import type { ChangeEvent, FormEvent, JSX } from "react";
import { useState } from "react";
import { useCreateChannel } from "../../hooks/use-channels.js";

interface CreateChannelDialogProps {
  readonly serverId: string;
}

export function CreateChannelDialog({ serverId }: CreateChannelDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createChannel = useCreateChannel(serverId);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    await createChannel.mutateAsync({
      name: name.toLowerCase().replaceAll(" ", "-"),
      type: "text",
    });
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={true}>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:text-foreground"
          title="Create Channel"
        >
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>Channels are where conversations happen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e: FormEvent) => void handleSubmit(e)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              placeholder="general"
              maxLength={100}
              required={true}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createChannel.isPending || !name.trim()}>
              {createChannel.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
