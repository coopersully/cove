import type { Server } from "@hearth/api-client";
import { cn } from "@hearth/ui";
import type { JSX } from "react";
import { Link, useParams } from "react-router";

interface ServerIconProps {
  readonly server: Server;
}

export function ServerIcon({ server }: ServerIconProps): JSX.Element {
  const { serverId } = useParams();
  const isActive = serverId === server.id;

  return (
    <Link
      to={`/servers/${server.id}`}
      className={cn(
        "group relative flex size-12 items-center justify-center rounded-full transition-all",
        isActive
          ? "rounded-2xl bg-ember text-warm-white"
          : "bg-elevated text-driftwood hover:rounded-2xl hover:bg-ember hover:text-warm-white",
      )}
      title={server.name}
    >
      {server.iconUrl ? (
        <img
          src={server.iconUrl}
          alt={server.name}
          className="size-full rounded-[inherit] object-cover"
        />
      ) : (
        <span className="font-semibold text-sm">{server.name.charAt(0).toUpperCase()}</span>
      )}
      {isActive && (
        <div className="-translate-x-2 -translate-y-1/2 absolute top-1/2 left-0 h-5 w-1 rounded-r-full bg-warm-white" />
      )}
    </Link>
  );
}
