import type { Server } from "@hearth/api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@hearth/ui";
import { ChevronDown, Flame, Hash, LogOut, Monitor, Moon, Sun, UserPen } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { EditProfileDialog } from "../layout/edit-profile-dialog.js";

interface MobileTopBarProps {
  readonly server: Server | undefined;
  readonly channelName: string | undefined;
  readonly onOpenServerPicker: () => void;
  readonly onOpenChannelPicker: () => void;
}

export function MobileTopBar({
  server,
  channelName,
  onOpenServerPicker,
  onOpenChannelPicker,
}: MobileTopBarProps): JSX.Element {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 rounded-2xl bg-card/80 px-2.5 shadow-sm ring-1 ring-border/40 backdrop-blur-xl">
      {/* Server avatar */}
      <button
        type="button"
        onClick={onOpenServerPicker}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors active:bg-secondary/50"
      >
        {server ? (
          <Avatar className="size-7">
            <AvatarImage src={server.iconUrl ?? undefined} alt={server.name} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {server.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-primary/10">
            <Flame className="size-3.5 text-primary" />
          </div>
        )}
        <ChevronDown className="size-3 text-muted-foreground" />
      </button>

      {/* Breadcrumb separator */}
      <span className="text-muted-foreground/50">/</span>

      {/* Channel name */}
      <button
        type="button"
        onClick={onOpenChannelPicker}
        disabled={!server}
        className="flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 transition-colors active:bg-secondary/50 disabled:opacity-50"
      >
        <Hash className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-semibold text-foreground text-sm">
          {channelName ?? "select"}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <MobileUserButton />
    </div>
  );
}

function MobileUserButton(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useThemeStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = user?.displayName ?? user?.username ?? "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            className="flex shrink-0 items-center justify-center rounded-full p-1 transition-colors active:bg-secondary/50"
            aria-label="User menu"
          >
            <Avatar className="size-7">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-muted-foreground text-xs">@{user?.username}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
            <UserPen className="size-4" />
            <span>Edit Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme(nextTheme)}>
            <ThemeIcon className="size-4" />
            <span>Theme: {themeLabel}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={logout}>
            <LogOut className="size-4" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <EditProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
