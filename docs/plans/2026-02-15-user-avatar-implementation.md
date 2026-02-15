# UserAvatar Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a shared `UserAvatar` component that renders user avatars with a consistent `bg-background` circular container across all surfaces (sidebar, chat, profile card, mobile).

**Architecture:** Extract inline Avatar+AvatarImage+AvatarFallback patterns from 5 files into a single `UserAvatar` component with size variants. Each size maps to a container/avatar/text size tuple. The outer container provides the `bg-background` backdrop that currently only the sidebar has.

**Tech Stack:** React, Tailwind CSS v4, Radix Avatar (via `@cove/ui`), DiceBear avataaars

---

### Task 1: Create the UserAvatar component

**Files:**
- Create: `apps/web/src/components/user-avatar.tsx`

**Step 1: Create the component file**

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@cove/ui";
import { cn } from "@cove/ui/cn";
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
        <AvatarImage
          src={user.avatarUrl ?? getUserAvatarUrl(user.id)}
          alt={displayName}
        />
        <AvatarFallback className={cn("bg-primary/10 text-primary", config.text)}>
          {initials}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}
```

**Step 2: Verify `cn` import path**

Check that `@cove/ui/cn` is a valid import. If not, use the `cn` from `@cove/ui` directly or from `../../lib/utils`. Adjust the import accordingly.

**Step 3: Commit**

```bash
git add apps/web/src/components/user-avatar.tsx
git commit -m "feat: add shared UserAvatar component"
```

---

### Task 2: Update desktop sidebar (UserButton)

**Files:**
- Modify: `apps/web/src/components/layout/server-sidebar.tsx:82-100`

**Step 1: Replace inline avatar in UserButton**

Replace the `<button>` wrapping the Avatar (lines 86-100) with:

```tsx
<button
  type="button"
  className="transition-colors"
  aria-label="User menu"
>
  <UserAvatar user={{ id: user?.id ?? "", avatarUrl: user?.avatarUrl, displayName: user?.displayName, username: user?.username ?? "" }} size="lg" />
</button>
```

**Step 2: Update imports**

- Remove: `Avatar`, `AvatarFallback`, `AvatarImage` from `@cove/ui` (if no longer used in this file — but `ServerIcon` is imported separately so these are safe to remove)
- Remove: `getUserAvatarUrl` import
- Add: `import { UserAvatar } from "../user-avatar.js";`

**Step 3: Verify the app renders correctly**

Run: `pnpm dev` and check sidebar user button visually.

**Step 4: Commit**

```bash
git add apps/web/src/components/layout/server-sidebar.tsx
git commit -m "refactor: use UserAvatar in desktop sidebar"
```

---

### Task 3: Update chat messages (MessageItem)

**Files:**
- Modify: `apps/web/src/components/messages/message-item.tsx:186-197`

**Step 1: Replace inline avatar in MessageItem**

Replace the Avatar block inside ProfileCard (lines 187-197) with:

```tsx
<button type="button" className="mt-0.5 shrink-0 cursor-pointer">
  <UserAvatar
    user={{ id: message.author.id, avatarUrl: message.author.avatarUrl, displayName: message.author.displayName, username: message.author.username }}
    size="lg"
  />
</button>
```

**Step 2: Update imports**

- Remove: `Avatar`, `AvatarFallback`, `AvatarImage` from `@cove/ui`
- Remove: `getUserAvatarUrl` import
- Remove: the `getInitials` function (lines 43-45)
- Add: `import { UserAvatar } from "../user-avatar.js";`

**Step 3: Commit**

```bash
git add apps/web/src/components/messages/message-item.tsx
git commit -m "refactor: use UserAvatar in chat messages"
```

---

### Task 4: Update profile card (ProfileCard)

**Files:**
- Modify: `apps/web/src/components/layout/profile-card.tsx:52-60`

**Step 1: Replace inline avatar in ProfileCard**

Replace the Avatar block (lines 52-60) with:

```tsx
<UserAvatar
  user={{ id: String(user.id), avatarUrl: user.avatarUrl, displayName: user.displayName, username: user.username }}
  size="xl"
/>
```

**Step 2: Update imports**

- Remove: `Avatar`, `AvatarFallback`, `AvatarImage` from `@cove/ui`
- Remove: `getUserAvatarUrl` import
- Remove: the `getInitials` function (lines 19-21)
- Add: `import { UserAvatar } from "../user-avatar.js";`

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/profile-card.tsx
git commit -m "refactor: use UserAvatar in profile card"
```

---

### Task 5: Update mobile top bar (MobileUserButton)

**Files:**
- Modify: `apps/web/src/components/mobile/mobile-top-bar.tsx:100-115`

**Step 1: Replace inline avatar in MobileUserButton**

Replace the `<button>` + Avatar block (lines 101-115) with:

```tsx
<button
  type="button"
  className="flex shrink-0 items-center justify-center rounded-full p-1 transition-colors active:bg-secondary/50"
  aria-label="User menu"
>
  <UserAvatar user={{ id: user?.id ?? "", avatarUrl: user?.avatarUrl, displayName: user?.displayName, username: user?.username ?? "" }} size="sm" />
</button>
```

**Step 2: Update imports**

- Remove: `getUserAvatarUrl` from avatar import (keep `getServerAvatarUrl`)
- Add: `import { UserAvatar } from "../user-avatar.js";`
- Keep: `Avatar`, `AvatarFallback`, `AvatarImage` — still used for server avatar in this file

**Step 3: Commit**

```bash
git add apps/web/src/components/mobile/mobile-top-bar.tsx
git commit -m "refactor: use UserAvatar in mobile top bar"
```

---

### Task 6: Update user section sidebar

**Files:**
- Modify: `apps/web/src/components/layout/user-section.tsx:38-46`

**Step 1: Replace inline avatar in UserSection**

Replace the Avatar block (lines 38-46) with:

```tsx
<UserAvatar user={{ id: user?.id ?? "", avatarUrl: user?.avatarUrl, displayName: user?.displayName, username: user?.username ?? "" }} size="default" />
```

**Step 2: Update imports**

- Remove: `Avatar`, `AvatarFallback`, `AvatarImage` from `@cove/ui`
- Remove: `getUserAvatarUrl` import
- Add: `import { UserAvatar } from "../user-avatar.js";`

**Step 3: Commit**

```bash
git add apps/web/src/components/layout/user-section.tsx
git commit -m "refactor: use UserAvatar in user section"
```

---

### Task 7: Final verification

**Step 1: Run type check**

```bash
pnpm tsc --noEmit
```

**Step 2: Run lint**

```bash
pnpm lint
```

**Step 3: Visual check**

Verify in the browser that all avatar locations render with the consistent `bg-background` circular container:
- Desktop sidebar user button
- Chat message avatars
- Profile card popup avatar
- Mobile top bar user avatar
- User section sidebar

**Step 4: Squash or final commit if needed**

If lint/format fixes are required, commit them:

```bash
git commit -m "style: format UserAvatar refactor"
```
