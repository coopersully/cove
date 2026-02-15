import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  Separator,
  cn,
} from "@hearth/ui";
import { ArrowDownToLine, Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useServers } from "../../hooks/use-servers.js";
import { CreateServerDialog } from "../layout/create-server-dialog.js";
import { JoinServerDialog } from "../layout/join-server-dialog.js";

interface MobileServerPickerProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function MobileServerPicker({ open, onOpenChange }: MobileServerPickerProps): JSX.Element {
  const { serverId } = useParams();
  const { data } = useServers();
  const servers = data?.servers ?? [];
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <>
      <Drawer direction="left" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="p-0">
          <DrawerTitle className="px-4 pt-4 pb-2 text-sm">Servers</DrawerTitle>
          <div className="flex flex-1 flex-col overflow-y-auto">
            {servers.map((server) => {
              const isActive = serverId === server.id;
              return (
                <DrawerClose key={server.id} asChild={true}>
                  <Link
                    to={`/servers/${server.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors active:bg-secondary/50",
                      isActive && "bg-secondary/70",
                    )}
                  >
                    <Avatar className="size-9 shrink-0">
                      <AvatarImage src={server.iconUrl ?? undefined} alt={server.name} />
                      <AvatarFallback
                        className={cn(
                          "text-xs font-semibold",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground",
                        )}
                      >
                        {server.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={cn(
                        "truncate text-sm",
                        isActive ? "font-semibold text-foreground" : "text-foreground/80",
                      )}
                    >
                      {server.name}
                    </span>
                  </Link>
                </DrawerClose>
              );
            })}
          </div>

          <Separator />
          <div className="flex items-center gap-2 p-3">
            <CreateServerDialog />
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setJoinOpen(true);
              }}
              className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors active:bg-emerald-600 active:text-white"
              aria-label="Join server"
            >
              <ArrowDownToLine className="size-5" />
            </button>
          </div>
        </DrawerContent>
      </Drawer>
      <JoinServerDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </>
  );
}
