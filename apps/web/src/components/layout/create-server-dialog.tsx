import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal, Tooltip, TooltipContent, TooltipTrigger } from "@hearth/ui";
import { createServerSchema } from "@hearth/shared";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateServer } from "../../hooks/use-servers.js";

export function CreateServerDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createServer = useCreateServer();

  return (
    <>
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
      <ResponsiveFormModal
        open={open}
        onOpenChange={setOpen}
        title="Create a server"
        description="Give your server a name and start building your community."
        schema={createServerSchema}
        defaultValues={{ name: "", description: "" }}
        onSubmit={async (data) => {
          const result = await createServer.mutateAsync({
            name: data.name,
            description: data.description || undefined,
          });
          setOpen(false);
          void navigate(`/servers/${result.server.id}`);
        }}
        submitLabel="Create"
        pendingLabel="Creating..."
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
                    <Input placeholder="My awesome server" {...field} />
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
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="What's your server about?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </ResponsiveFormModal>
    </>
  );
}
