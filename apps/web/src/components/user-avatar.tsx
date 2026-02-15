import { Avatar, AvatarFallback, AvatarImage, cn } from "@cove/ui";
import type { JSX } from "react";
import { getUserAvatarUrl } from "../lib/avatar.js";

interface UserAvatarProps {
  readonly user: {
    id: string;
    avatarUrl?: string | null;
    displayName?: string | null;
    username: string;
  };
  readonly size?: "sm" | "default" | "lg" | "xl";
  readonly className?: string;
}

const sizeConfig = {
  sm: { container: "size-8", avatar: "size-7", text: "text-xs" },
  default: { container: "size-10", avatar: "size-8", text: "text-xs" },
  lg: { container: "size-12", avatar: "size-10", text: "text-xs" },
  xl: { container: "size-18", avatar: "size-16", text: "text-lg" },
} as const;

export function UserAvatar({ user, size = "default", className }: UserAvatarProps): JSX.Element {
  const config = sizeConfig[size];
  const displayName = user.displayName ?? user.username;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-background",
        config.container,
        className,
      )}
    >
      <Avatar className={config.avatar}>
        <AvatarImage src={user.avatarUrl ?? getUserAvatarUrl(user.id)} alt={displayName} />
        <AvatarFallback className={cn("bg-primary/10 text-primary", config.text)}>
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
