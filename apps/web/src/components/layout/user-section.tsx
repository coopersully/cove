import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cove/ui";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import type { JSX } from "react";
import { useAuthStore } from "../../stores/auth.js";
import { useThemeStore } from "../../stores/theme.js";
import { UserAvatar } from "../user-avatar.js";

export function UserSection(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, setTheme } = useThemeStore();

  const displayName = user?.displayName ?? user?.username ?? "User";

  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const themeLabel = theme === "dark" ? "Dark" : theme === "light" ? "Light" : "System";

  return (
    <div className="flex items-center gap-2 border-sidebar-border border-t bg-sidebar px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild={true}>
          <button
            type="button"
            className="flex flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-sidebar-accent/50"
          >
            <UserAvatar
              user={{
                id: user?.id ?? "",
                avatarUrl: user?.avatarUrl,
                displayName: user?.displayName,
                username: user?.username ?? "",
              }}
              size="default"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground text-xs">{displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">@{user?.username}</p>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1">
              <p className="font-medium text-sm">{displayName}</p>
              <p className="text-muted-foreground text-xs">@{user?.username}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
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
    </div>
  );
}
