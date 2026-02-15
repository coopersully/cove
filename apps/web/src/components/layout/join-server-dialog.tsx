import { joinServerSchema } from "@hearth/shared";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
} from "@hearth/ui";
import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useJoinServer } from "../../hooks/use-servers.js";

interface JoinServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function JoinServerDialog({ open, onOpenChange }: JoinServerDialogProps): JSX.Element {
  const joinServer = useJoinServer();
  const navigate = useNavigate();

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Join a Server"
      description="Enter a server ID or invite code to join a server."
      schema={joinServerSchema}
      defaultValues={{ serverId: "" }}
      onSubmit={async (data) => {
        await joinServer.mutateAsync({ serverId: data.serverId });
        onOpenChange(false);
        void navigate(`/servers/${data.serverId}`);
      }}
      submitLabel="Join Server"
      pendingLabel="Joining..."
    >
      {(form) => (
        <FormField
          control={form.control}
          name="serverId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter server ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </ResponsiveFormModal>
  );
}
