import { Button, ScrollArea } from "@cove/ui";
import { Check, MessageSquare, Plus, UserMinus, Users, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useCreateDm } from "../../hooks/use-dms.js";
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriends,
  useIncomingRequests,
  useOutgoingRequests,
  useRemoveFriend,
} from "../../hooks/use-friends.js";
import { UserAvatar } from "../user-avatar.js";
import { AddFriendDialog } from "./add-friend-dialog.js";

type Tab = "all" | "pending";

export function FriendsList(): JSX.Element {
  const [tab, setTab] = useState<Tab>("all");
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex w-[260px] flex-col border-sidebar-border border-r bg-sidebar">
      <div className="flex h-12 items-center justify-between border-border border-b px-4">
        <h2 className="font-display font-semibold text-foreground text-sm">Friends</h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Add Friend"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="flex border-border border-b">
        <button
          type="button"
          onClick={() => setTab("all")}
          className={`flex-1 py-2 font-medium text-xs transition-colors ${
            tab === "all"
              ? "border-primary border-b-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={`flex-1 py-2 font-medium text-xs transition-colors ${
            tab === "pending"
              ? "border-primary border-b-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Pending
        </button>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-2">
          {tab === "all" ? <AllFriends /> : <PendingRequests />}
        </div>
      </ScrollArea>
      <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AllFriends(): JSX.Element {
  const { data, isLoading } = useFriends();
  const friends = data?.friends ?? [];
  const removeFriend = useRemoveFriend();
  const createDm = useCreateDm();

  if (isLoading) {
    return <div className="px-4 py-8 text-center text-muted-foreground text-xs">Loading...</div>;
  }

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
        <Users className="size-8 opacity-50" />
        <p className="font-body text-xs">No friends yet. Add someone!</p>
      </div>
    );
  }

  return (
    <>
      {friends.map((friend) => {
        const name = friend.displayName ?? friend.username;
        return (
          <div key={friend.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
            <UserAvatar
              user={{
                id: friend.id,
                avatarUrl: friend.avatarUrl,
                displayName: friend.displayName,
                username: friend.username,
              }}
              size="sm"
            />
            <span className="flex-1 truncate text-foreground">{name}</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-foreground"
                title="Message"
                disabled={createDm.isPending}
                onClick={() => createDm.mutate({ recipientId: friend.id })}
              >
                <MessageSquare className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground hover:text-destructive"
                title="Remove Friend"
                disabled={removeFriend.isPending}
                onClick={() => removeFriend.mutate(friend.id)}
              >
                <UserMinus className="size-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </>
  );
}

function PendingRequests(): JSX.Element {
  const { data: incomingData, isLoading: incomingLoading } = useIncomingRequests();
  const { data: outgoingData, isLoading: outgoingLoading } = useOutgoingRequests();
  const incoming = incomingData?.requests ?? [];
  const outgoing = outgoingData?.requests ?? [];
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();

  if (incomingLoading || outgoingLoading) {
    return <div className="px-4 py-8 text-center text-muted-foreground text-xs">Loading...</div>;
  }

  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
        <Users className="size-8 opacity-50" />
        <p className="font-body text-xs">No pending requests</p>
      </div>
    );
  }

  return (
    <>
      {incoming.length > 0 && (
        <>
          <p className="px-2 pt-2 pb-1 font-body text-muted-foreground text-xs uppercase">
            Incoming
          </p>
          {incoming.map((req) => {
            const name = req.user.displayName ?? req.user.username;
            return (
              <div key={req.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
                <UserAvatar
                  user={{
                    id: req.user.id,
                    avatarUrl: req.user.avatarUrl,
                    displayName: req.user.displayName,
                    username: req.user.username,
                  }}
                  size="sm"
                />
                <span className="flex-1 truncate text-foreground">{name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-emerald-500"
                    title="Accept"
                    disabled={acceptRequest.isPending}
                    onClick={() => acceptRequest.mutate(req.id)}
                  >
                    <Check className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    title="Decline"
                    disabled={declineRequest.isPending}
                    onClick={() => declineRequest.mutate(req.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <p className="px-2 pt-2 pb-1 font-body text-muted-foreground text-xs uppercase">
            Outgoing
          </p>
          {outgoing.map((req) => {
            const name = req.user.displayName ?? req.user.username;
            return (
              <div key={req.id} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm">
                <UserAvatar
                  user={{
                    id: req.user.id,
                    avatarUrl: req.user.avatarUrl,
                    displayName: req.user.displayName,
                    username: req.user.username,
                  }}
                  size="sm"
                />
                <span className="flex-1 truncate text-foreground">{name}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground hover:text-destructive"
                  title="Cancel"
                  disabled={declineRequest.isPending}
                  onClick={() => declineRequest.mutate(req.id)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
