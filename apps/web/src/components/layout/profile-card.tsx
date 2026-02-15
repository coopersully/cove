import { Popover, PopoverContent, PopoverTrigger } from "@cove/ui";
import type { JSX, ReactNode } from "react";
import { useUserProfile } from "../../hooks/use-user-profile.js";
import { MarkdownContent } from "../messages/markdown-content.js";
import { UserAvatar } from "../user-avatar.js";

interface ProfileCardProps {
  readonly userId: string;
  readonly children: ReactNode;
}

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function ProfileCard({ userId, children }: ProfileCardProps): JSX.Element {
  const { data, status } = useUserProfile(userId);
  const user = data?.user;

  return (
    <Popover>
      <PopoverTrigger asChild={true}>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        {status === "pending" && (
          <div className="flex items-center justify-center p-8">
            <div className="size-4 animate-cove-ember rounded-full bg-primary/80" />
          </div>
        )}
        {status === "error" && (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Failed to load profile
          </div>
        )}
        {user && (
          <div className="flex flex-col">
            {/* Header with avatar */}
            <div className="flex items-start gap-3 p-4 pb-3">
              <UserAvatar
                user={{
                  id: String(user.id),
                  avatarUrl: user.avatarUrl,
                  displayName: user.displayName,
                  username: user.username,
                }}
                size="xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-display font-semibold text-foreground">
                    {user.displayName ?? user.username}
                  </span>
                  {user.statusEmoji && (
                    <span className="shrink-0 text-base" role="img">
                      {user.statusEmoji}
                    </span>
                  )}
                </div>
                <div className="text-muted-foreground text-sm">@{user.username}</div>
                {user.pronouns && (
                  <div className="mt-0.5 text-muted-foreground text-xs">{user.pronouns}</div>
                )}
              </div>
            </div>

            {/* Status */}
            {user.status && (
              <div className="border-t px-4 py-2.5">
                <div className="text-sm">{user.status}</div>
              </div>
            )}

            {/* Bio */}
            {user.bio && (
              <div className="border-t px-4 py-2.5">
                <div className="text-sm">
                  <MarkdownContent content={user.bio} />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="border-t px-4 py-2.5">
              <div className="text-muted-foreground text-xs">
                Member since {formatJoinDate(String(user.createdAt))}
              </div>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
