import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@cove/ui";
import { Users } from "lucide-react";
import type { JSX } from "react";
import { useCreateDm } from "../../hooks/use-dms.js";
import { useFriends } from "../../hooks/use-friends.js";
import { UserAvatar } from "../user-avatar.js";

interface CreateDmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function CreateDmDialog({ open, onOpenChange }: CreateDmDialogProps): JSX.Element {
  const { data } = useFriends();
  const friends = data?.friends ?? [];
  const createDm = useCreateDm();

  function handleSelect(userId: string) {
    createDm.mutate(
      { recipientId: userId },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Direct Message</DialogTitle>
          <DialogDescription>Select a friend to start a conversation.</DialogDescription>
        </DialogHeader>
        <div className="max-h-60 overflow-y-auto">
          {friends.length > 0 ? (
            <div className="flex flex-col gap-1">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => handleSelect(friend.id)}
                  disabled={createDm.isPending}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
                >
                  <UserAvatar
                    user={{
                      id: friend.id,
                      avatarUrl: friend.avatarUrl,
                      displayName: friend.displayName,
                      username: friend.username,
                    }}
                    size="sm"
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {friend.displayName ?? friend.username}
                    </span>
                    <span className="text-muted-foreground text-xs">@{friend.username}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Users className="size-8 opacity-50" />
              <p className="text-xs">Add friends first to start a conversation</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
