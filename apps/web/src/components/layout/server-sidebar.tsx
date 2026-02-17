import type { Server } from "@cove/api-client";
import {
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
} from "@cove/ui";
import {
  ArrowDownToLine,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  UserPen,
  Users,
} from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useChannels } from "../../hooks/use-channels.js";
import { useServers } from "../../hooks/use-servers.js";
import { useServerUnread } from "../../hooks/use-unread.js";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { UserAvatar } from "../user-avatar.js";
import { CreateServerDialog } from "./create-server-dialog.js";
import { EditProfileDialog } from "./edit-profile-dialog.js";
import { JoinServerDialog } from "./join-server-dialog.js";
import { ServerIcon } from "./server-icon.js";

export function ServerSidebar(): JSX.Element {
  const { data } = useServers();
  const servers = data?.servers ?? [];
  const [joinOpen, setJoinOpen] = useState(false);
  const location = useLocation();
  const isDmActive = location.pathname.startsWith("/dms");
  const isFriendsActive = location.pathname.startsWith("/friends");

  return (
    <aside className="flex w-[72px] flex-col items-center border-sidebar-border border-r bg-sidebar">
      <ScrollArea className="w-full flex-1">
        <nav className="flex flex-col items-center gap-2 px-3 py-3">
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Link
                to="/dms"
                className={`group relative flex size-12 items-center justify-center rounded-full transition-colors ${
                  isDmActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-sidebar-accent text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
                aria-label="Direct Messages"
              >
                <MessageSquare className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Direct Messages
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <Link
                to="/friends"
                className={`group relative flex size-12 items-center justify-center rounded-full transition-colors ${
                  isFriendsActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-sidebar-accent text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                }`}
                aria-label="Friends"
              >
                <Users className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              Friends
            </TooltipContent>
          </Tooltip>
          <Separator className="mx-auto w-8 bg-sidebar" />
          {servers.map((server) => (
            <ServerIconWithUnread key={server.id} server={server} />
          ))}
          <Separator className="mx-auto w-8 bg-sidebar" />
          <CreateServerDialog />
          <Tooltip>
            <TooltipTrigger asChild={true}>
              <button
                type="button"
                onClick={() => setJoinOpen(true)}
                className="group relative flex size-12 items-center justify-center rounded-full bg-sidebar-accent text-muted-foreground transition-colors hover:bg-emerald-600 hover:text-white"
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
      <Separator className="mx-auto w-8 bg-sidebar" />
      <div className="py-3">
        <UserButton />
      </div>
    </aside>
  );
}

function ServerIconWithUnread({ server }: { readonly server: Server }): JSX.Element {
  const { data } = useChannels(server.id);
  const channelIds = (data?.channels ?? []).map((channel) => channel.id);
  const hasUnread = useServerUnread(channelIds);

  return <ServerIcon server={server} hasUnread={hasUnread} />;
}

function UserButton(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useThemeStore();
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = user?.displayName ?? user?.username ?? "User";

  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button type="button" className="transition-colors" aria-label="User menu">
            <UserAvatar
              user={{
                id: user?.id ?? "",
                avatarUrl: user?.avatarUrl,
                displayName: user?.displayName,
                username: user?.username ?? "",
              }}
              size="lg"
            />
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
