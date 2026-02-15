import type { Server } from "@cove/api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@cove/ui";
import type { JSX } from "react";
import { Link, useParams } from "react-router";
import { getServerAvatarUrl } from "../../lib/avatar.js";

interface ServerIconProps {
  readonly server: Server;
}

export function ServerIcon({ server }: ServerIconProps): JSX.Element {
  const { serverId } = useParams();
  const isActive = serverId === server.id;

  return (
    <Tooltip>
      <TooltipTrigger asChild={true}>
        <Link
          to={`/servers/${server.id}`}
          className={cn(
            "group relative flex size-12 items-center justify-center rounded-full transition-colors",
            isActive
              ? "bg-primary text-primary-foreground"
              : "bg-sidebar-accent text-muted-foreground hover:bg-primary hover:text-primary-foreground",
          )}
        >
          <Avatar className="size-full rounded-[inherit]">
            <AvatarImage src={server.iconUrl ?? getServerAvatarUrl(server.id)} alt={server.name} />
            <AvatarFallback className="rounded-[inherit] bg-transparent font-semibold text-sm">
              {server.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {isActive && (
            <div className="-translate-x-2 -translate-y-1/2 absolute top-1/2 left-0 h-5 w-1 rounded-r-full bg-foreground" />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {server.name}
      </TooltipContent>
    </Tooltip>
  );
}
