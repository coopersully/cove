import type { Server } from "@hearth/api-client";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal } from "@hearth/ui";
import { serverSettingsSchema } from "@hearth/shared";
import type { JSX } from "react";
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
  const updateServer = useUpdateServer(server.id);

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Server Settings"
      schema={serverSettingsSchema}
      defaultValues={{
        name: server.name,
        description: server.description ?? "",
      }}
      onSubmit={async (data) => {
        await updateServer.mutateAsync({
          name: data.name.trim(),
          description: data.description?.trim() || null,
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
                <FormLabel>Server name</FormLabel>
                <FormControl>
                  <Input placeholder="My Server" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="What is this server about?" {...field} />
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
