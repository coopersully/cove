import { createChannelSchema } from "@cove/shared";
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
} from "@cove/ui";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useCreateChannel } from "../../hooks/use-channels.js";

interface CreateChannelDialogProps {
  readonly serverId: string;
}

export function CreateChannelDialog({ serverId }: CreateChannelDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const createChannel = useCreateChannel(serverId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        title="Create Channel"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>
      <ResponsiveFormModal
        open={open}
        onOpenChange={setOpen}
        title="Create a channel"
        description="Channels are where conversations happen."
        schema={createChannelSchema}
        defaultValues={{ name: "", type: "text" as const }}
        onSubmit={async (data) => {
          await createChannel.mutateAsync({
            name: data.name.toLowerCase().replaceAll(" ", "-"),
            type: data.type,
          });
          setOpen(false);
        }}
        submitLabel="Create"
        pendingLabel="Creating..."
      >
        {(form) => (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel name</FormLabel>
                <FormControl>
                  <Input placeholder="general" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </ResponsiveFormModal>
    </>
  );
}
