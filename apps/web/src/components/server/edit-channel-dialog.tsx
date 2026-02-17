import type { Channel } from "@cove/api-client";
import { editChannelSchema } from "@cove/shared";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
} from "@cove/ui";
import type { JSX } from "react";
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
  const serverId = channel.serverId ?? "";
  const updateChannel = useUpdateChannel(serverId);

  if (!serverId) {
    throw new Error("EditChannelDialog requires a server channel");
  }

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Channel"
      schema={editChannelSchema}
      defaultValues={{
        name: channel.name,
        topic: channel.topic ?? "",
      }}
      onSubmit={async (data) => {
        const trimmedName = data.name.trim().toLowerCase().replace(/\s+/g, "-");
        await updateChannel.mutateAsync({
          channelId: channel.id,
          data: {
            name: trimmedName,
            topic: data.topic?.trim() || null,
          },
        });
        onOpenChange(false);
      }}
      submitLabel="Save Changes"
      pendingLabel="Saving..."
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel name</FormLabel>
                <FormControl>
                  <Input placeholder="channel-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input placeholder="What is this channel about?" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ResponsiveFormModal>
  );
}
