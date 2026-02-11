import type { Server } from "@hearth/api-client";
import { Avatar, AvatarFallback, AvatarImage, cn, Tooltip, TooltipContent, TooltipTrigger } from "@hearth/ui";
import type { JSX } from "react";
import { Link, useParams } from "react-router";

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
            "group relative flex size-12 items-center justify-center rounded-full transition-all",
            isActive
              ? "rounded-2xl bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:rounded-2xl hover:bg-primary hover:text-primary-foreground",
          )}
        >
          <Avatar className="size-full rounded-[inherit]">
            <AvatarImage src={server.iconUrl ?? undefined} alt={server.name} />
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
