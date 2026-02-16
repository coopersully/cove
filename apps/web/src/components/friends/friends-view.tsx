import { Users } from "lucide-react";
import type { JSX } from "react";
import { useDocumentTitle } from "../../hooks/use-document-title.js";
import { FriendsList } from "./friends-list.js";

export function FriendsView(): JSX.Element {
  useDocumentTitle("Friends");

  return (
    <>
      <FriendsList />
      <div className="flex flex-1 items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-8 text-primary" />
          </div>
          <p className="font-body text-sm">Manage your friends and requests</p>
        </div>
      </div>
    </>
  );
}
