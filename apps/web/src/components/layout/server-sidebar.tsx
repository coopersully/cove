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
  ScrollArea,
  Separator,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hearth/ui";
import { ArrowDownToLine, LogOut, Monitor, Moon, Sun, UserPen } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useServers } from "../../hooks/use-servers.js";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { CreateServerDialog } from "./create-server-dialog.js";
import { EditProfileDialog } from "./edit-profile-dialog.js";
import { JoinServerDialog } from "./join-server-dialog.js";
import { ServerIcon } from "./server-icon.js";

export function ServerSidebar(): JSX.Element {
  const { data } = useServers();
  const servers = data?.servers ?? [];
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <aside className="flex w-[72px] flex-col items-center bg-secondary">
      <ScrollArea className="w-full flex-1">
        <nav className="flex flex-col items-center gap-2 px-3 py-3">
          {servers.map((server) => (
            <ServerIcon key={server.id} server={server} />
          ))}
          <Separator className="mx-auto w-8 bg-secondary" />
          <CreateServerDialog />
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                className="group relative flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-emerald-600 hover:text-white"
                aria-label="Join server"
              >
                <ArrowDownToLine className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Join a Server
            </TooltipContent>
          </Tooltip>
          <JoinServerDialog open={joinOpen} onOpenChange={setJoinOpen} />
        </nav>
      </ScrollArea>
      <Separator className="mx-auto w-8 bg-secondary" />
      <div className="py-3">
        <UserButton />
      </div>
    </aside>
  );
}

function UserButton(): JSX.Element {
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
            className="flex size-12 items-center justify-center rounded-full transition-colors"
            aria-label="User menu"
          >
            <Avatar className="size-10">
              <AvatarImage src={user?.avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
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
