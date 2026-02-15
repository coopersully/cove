import type { Channel } from "@hearth/api-client";
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
import type { FormEvent, JSX } from "react";
import { useState } from "react";
import { useUpdateChannel } from "../../hooks/use-channels.js";

interface EditChannelDialogProps {
  readonly channel: Channel;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
}: EditChannelDialogProps): JSX.Element {
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic ?? "");
  const updateChannel = useUpdateChannel(channel.serverId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmedName) {
      return;
    }

    updateChannel.mutate(
      {
        channelId: channel.id,
        data: {
          name: trimmedName,
          topic: topic.trim() || null,
        },
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Channel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel name</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="channel-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="channel-topic">Topic</Label>
            <Input
              id="channel-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={1024}
              placeholder="What is this channel about?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || updateChannel.isPending}>
              {updateChannel.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
