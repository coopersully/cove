import { ScrollArea, Separator } from "@hearth/ui";
import type { JSX } from "react";
import { useServers } from "../../hooks/use-servers.js";
import { CreateServerDialog } from "./create-server-dialog.js";
import { ServerIcon } from "./server-icon.js";

export function ServerSidebar(): JSX.Element {
  const { data } = useServers();
  const servers = data?.servers ?? [];

  return (
    <div className="flex w-[72px] flex-col items-center gap-2 bg-surface py-3">
      <ScrollArea className="flex-1">
        <div className="flex flex-col items-center gap-2 px-3">
          {servers.map((server) => (
            <ServerIcon key={server.id} server={server} />
          ))}
        </div>
      </ScrollArea>
      <Separator className="mx-auto w-8 bg-elevated" />
      <CreateServerDialog />
    </div>
  );
}
