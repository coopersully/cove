import type { Server } from "@cove/api-client";
import { serverSettingsSchema } from "@cove/shared";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
} from "@cove/ui";
import type { JSX } from "react";
import { useUpdateServer } from "../../hooks/use-servers.js";
import { getServerAvatarUrl } from "../../lib/avatar.js";

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
        iconUrl: server.iconUrl ?? "",
      }}
      onSubmit={async (data) => {
        await updateServer.mutateAsync({
          name: data.name.trim(),
          description: data.description?.trim() || null,
          iconUrl: data.iconUrl?.trim() || null,
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
            name="iconUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Icon</FormLabel>
                <div className="flex items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                    <Avatar className="size-full rounded-[inherit]">
                      <AvatarImage
                        src={field.value || getServerAvatarUrl(server.id)}
                        alt={server.name}
                      />
                      <AvatarFallback className="rounded-[inherit] bg-transparent font-semibold text-sm">
                        {server.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1">
                    <FormControl>
                      <Input placeholder="https://example.com/icon.png" {...field} />
                    </FormControl>
                    <FormDescription>Paste an image URL</FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
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
