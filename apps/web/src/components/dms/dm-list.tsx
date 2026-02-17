import { ScrollArea } from "@cove/ui";
import { MessageSquare, Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useDms } from "../../hooks/use-dms.js";
import { UserAvatar } from "../user-avatar.js";
import { CreateDmDialog } from "./create-dm-dialog.js";

export function DmList(): JSX.Element {
  const { channelId } = useParams();
  const { data } = useDms();
  const dms = data?.channels ?? [];
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex w-[260px] flex-col border-sidebar-border border-r bg-sidebar">
      <div className="flex h-12 items-center justify-between border-border border-b px-4">
        <h2 className="font-display font-semibold text-foreground text-sm">Direct Messages</h2>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="New DM"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {dms.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
              <MessageSquare className="size-8 opacity-50" />
              <p className="font-body text-xs">No conversations yet</p>
            </div>
          ) : (
            dms.map((dm) => {
              const isActive = dm.id === channelId;
              const name = dm.recipient.displayName ?? dm.recipient.username;
              return (
                <Link
                  key={dm.id}
                  to={`/dms/${dm.id}`}
                  className={`flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <UserAvatar
                    user={{
                      id: dm.recipient.id,
                      avatarUrl: dm.recipient.avatarUrl,
                      displayName: dm.recipient.displayName,
                      username: dm.recipient.username,
                    }}
                    size="sm"
                  />
                  <span className="truncate">{name}</span>
                </Link>
              );
            })
          )}
        </div>
      </ScrollArea>
      <CreateDmDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
