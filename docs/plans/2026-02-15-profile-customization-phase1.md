# Profile Customization Phase 1: Bio, Pronouns, Status Emoji & Profile Card

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bio, pronouns, and status emoji fields to user profiles, and build a profile card popover visible when clicking a user in chat.

**Architecture:** New nullable columns on the `users` table, plumbed through the full stack: DB schema → auth middleware → API routes → API client types → frontend stores/hooks → UI components. A new profile card popover component appears when clicking a username in the message feed. Status emoji displays inline next to usernames in chat. Bio renders as markdown using the existing `MarkdownContent` component.

**Tech Stack:** Drizzle ORM (schema + migration), Hono (API), Zod (validation), React 19, Radix UI Popover (profile card), react-hook-form, Tailwind CSS, @tanstack/react-query.

---

## Task 1: Database Schema — Add Profile Columns

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/db/src/schema/index.ts:16-26`

**Step 1: Add constants for new field limits**

In `packages/shared/src/constants.ts`, add after line 17 (`MAX_STATUS_LENGTH`):

```typescript
export const MAX_BIO_LENGTH = 280 as const;
export const MAX_PRONOUNS_LENGTH = 30 as const;
export const MAX_STATUS_EMOJI_LENGTH = 8 as const;
```

**Step 2: Add columns to users table schema**

In `packages/db/src/schema/index.ts`, add three new columns to the `users` table after the `status` field (line 23):

```typescript
bio: varchar({ length: 280 }),
pronouns: varchar({ length: 30 }),
statusEmoji: varchar("status_emoji", { length: 8 }),
```

**Step 3: Generate the Drizzle migration**

Run: `cd packages/db && npx drizzle-kit generate`

This should create a new migration file like `drizzle/0002_*.sql` with three `ALTER TABLE` statements adding the nullable columns.

**Step 4: Apply the migration**

Run: `cd packages/db && npx drizzle-kit push`

Expected: Columns `bio`, `pronouns`, and `status_emoji` are added to the `users` table.

**Step 5: Commit**

```
feat(db): add bio, pronouns, and statusEmoji columns to users table
```

---

## Task 2: Shared Validators — Add Zod Schemas for New Fields

**Files:**
- Modify: `packages/shared/src/validators.ts`
- Modify: `packages/shared/src/schemas.ts:80-83`

**Step 1: Add field-level validators**

In `packages/shared/src/validators.ts`, add the import of the new constants at the top (extend the existing import on line 3-16), then add after `statusSchema` (line 47):

```typescript
export const bioSchema = z
  .string()
  .max(MAX_BIO_LENGTH, `Bio must be at most ${String(MAX_BIO_LENGTH)} characters`);

export const pronounsSchema = z
  .string()
  .max(MAX_PRONOUNS_LENGTH, `Pronouns must be at most ${String(MAX_PRONOUNS_LENGTH)} characters`);

export const statusEmojiSchema = z
  .string()
  .max(
    MAX_STATUS_EMOJI_LENGTH,
    `Status emoji must be at most ${String(MAX_STATUS_EMOJI_LENGTH)} characters`,
  );
```

**Step 2: Update editProfileSchema**

In `packages/shared/src/schemas.ts`, import `bioSchema`, `pronounsSchema`, and `statusEmojiSchema` from `./validators.js` (extend the existing import on lines 3-15). Then update `editProfileSchema` (lines 80-83):

```typescript
export const editProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  status: statusSchema.optional(),
  bio: bioSchema.optional(),
  pronouns: pronounsSchema.optional(),
  statusEmoji: statusEmojiSchema.optional(),
});
```

**Step 3: Verify types compile**

Run: `cd packages/shared && pnpm check`

Expected: No type errors.

**Step 4: Commit**

```
feat(shared): add Zod validators for bio, pronouns, and statusEmoji
```

---

## Task 3: Auth Middleware — Expose New Fields on AuthUser

**Files:**
- Modify: `packages/auth/src/middleware.ts:8-17` (AuthUser interface) and `:35-46` (select query)

**Step 1: Extend the AuthUser interface**

In `packages/auth/src/middleware.ts`, add three fields to the `AuthUser` interface (after `status` on line 14):

```typescript
bio: string | null;
pronouns: string | null;
statusEmoji: string | null;
```

**Step 2: Add columns to the select query**

In the same file, extend the `.select()` call in `requireAuth()` (lines 36-45) to include:

```typescript
bio: users.bio,
pronouns: users.pronouns,
statusEmoji: users.statusEmoji,
```

**Step 3: Verify types compile**

Run: `cd packages/auth && pnpm check`

Expected: No type errors.

**Step 4: Commit**

```
feat(auth): include bio, pronouns, and statusEmoji in AuthUser
```

---

## Task 4: API Client Types — Extend User and Request Types

**Files:**
- Modify: `packages/api-client/src/types.ts`

**Step 1: Add fields to the `User` interface**

In `packages/api-client/src/types.ts`, add three fields to the `User` interface after `status` (line 11):

```typescript
readonly bio: string | null;
readonly pronouns: string | null;
readonly statusEmoji: string | null;
```

**Step 2: Add `statusEmoji` to `MessageAuthor`**

In the `MessageAuthor` interface (lines 36-41), add after `avatarUrl`:

```typescript
readonly statusEmoji: string | null;
```

Note: We intentionally do NOT add `bio` or `pronouns` to `MessageAuthor`. Those are profile-level data, not per-message data.

**Step 3: Add fields to `UpdateProfileRequest`**

In `UpdateProfileRequest` (lines 69-73), add:

```typescript
readonly bio?: string | null;
readonly pronouns?: string | null;
readonly statusEmoji?: string | null;
```

**Step 4: Add a `UserProfileResponse` type**

After `UserResponse` (lines 143-145), add:

```typescript
export interface UserProfileResponse {
  readonly user: Omit<User, "email">;
}
```

**Step 5: Verify types compile**

Run: `cd packages/api-client && pnpm check`

Expected: No type errors.

**Step 6: Commit**

```
feat(api-client): add bio, pronouns, statusEmoji to User and MessageAuthor types
```

---

## Task 5: API Routes — Update User Endpoints

**Files:**
- Modify: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/routes/auth.ts` (returning clauses)
- Modify: `apps/api/src/routes/messages.ts:69-111` (message author join)

**Step 1: Update PATCH /users/me**

In `apps/api/src/routes/users.ts`, update the `updateProfileSchema` (lines 10-14) to include the new fields:

```typescript
const updateProfileSchema = z.object({
  displayName: displayNameSchema.nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: statusSchema.nullable().optional(),
  bio: bioSchema.nullable().optional(),
  pronouns: pronounsSchema.nullable().optional(),
  statusEmoji: statusEmojiSchema.nullable().optional(),
});
```

Import `bioSchema`, `pronounsSchema`, `statusEmojiSchema` from `@cove/shared` (extend line 3).

Update the `.returning()` clause (lines 38-47) to include the new fields:

```typescript
bio: users.bio,
pronouns: users.pronouns,
statusEmoji: users.statusEmoji,
```

**Step 2: Add GET /users/:userId route**

Add a new route in `users.ts` for fetching another user's public profile. After the existing `PATCH /users/me` handler:

```typescript
// GET /users/:userId
userRoutes.get("/:userId", async (c) => {
  const userId = c.req.param("userId");

  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      status: users.status,
      bio: users.bio,
      pronouns: users.pronouns,
      statusEmoji: users.statusEmoji,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, BigInt(userId)))
    .limit(1);

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  return c.json({ user: { ...user, id: String(user.id) } });
});
```

Note: This deliberately excludes `email` and `passwordHash` from the response.

**Step 3: Update auth route returning clauses**

In `apps/api/src/routes/auth.ts`, update the register handler's `.returning()` (lines 117-125) to include:

```typescript
bio: users.bio,
pronouns: users.pronouns,
statusEmoji: users.statusEmoji,
```

Update the login handler's response object (lines 163-172) to include:

```typescript
bio: user.bio,
pronouns: user.pronouns,
statusEmoji: user.statusEmoji,
```

**Step 4: Update the messages route author join**

In `apps/api/src/routes/messages.ts`, update the select clause in the GET handler (lines 71-79) to add:

```typescript
authorStatusEmoji: users.statusEmoji,
```

Then update the response mapping (lines 97-111) to include `statusEmoji` in the author object:

```typescript
author: {
  id: String(m.authorId),
  username: m.authorUsername,
  displayName: m.authorDisplayName,
  avatarUrl: m.authorAvatarUrl,
  statusEmoji: m.authorStatusEmoji,
},
```

Do the same for the POST create-message response (lines 154-171) — the author object there uses `user.statusEmoji` directly since it comes from the auth middleware.

**Step 5: Verify the API compiles**

Run: `cd apps/api && pnpm check`

Expected: No type errors.

**Step 6: Commit**

```
feat(api): add bio/pronouns/statusEmoji to user routes and message author data
```

---

## Task 6: API Client Resource — Add `getUser` Method

**Files:**
- Modify: `packages/api-client/src/resources/users.ts`

**Step 1: Extend the UserResource**

Add a `getUser` method to the `UserResource` interface and implementation:

```typescript
import type { HttpClient } from "../http.js";
import type { UpdateProfileRequest, UserProfileResponse, UserResponse } from "../types.js";

export interface UserResource {
  getMe(): Promise<UserResponse>;
  getUser(userId: string): Promise<UserProfileResponse>;
  updateMe(data: UpdateProfileRequest): Promise<UserResponse>;
}

export function createUserResource(http: HttpClient): UserResource {
  return {
    getMe: () => http.get<UserResponse>("/users/me"),
    getUser: (userId) => http.get<UserProfileResponse>(`/users/${userId}`),
    updateMe: (data) => http.patch<UserResponse>("/users/me", data),
  };
}
```

**Step 2: Verify types compile**

Run: `cd packages/api-client && pnpm check`

Expected: No type errors.

**Step 3: Commit**

```
feat(api-client): add getUser method for fetching public user profiles
```

---

## Task 7: Frontend — Update Edit Profile Dialog

**Files:**
- Modify: `apps/web/src/components/layout/edit-profile-dialog.tsx`

**Step 1: Add bio, pronouns, and statusEmoji fields to the dialog**

Replace the contents of `edit-profile-dialog.tsx` with an extended version that adds the new fields. The form should have:
- Display name (existing `Input`)
- Status (existing `Input`)
- Status emoji (`Input` with `maxLength={8}` and emoji-style placeholder)
- Pronouns (`Input` with `maxLength={30}` and placeholder like "e.g. they/them")
- Bio (`Textarea` with `maxLength={280}` and character counter)

```tsx
import { editProfileSchema } from "@cove/shared";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
  Textarea,
} from "@cove/ui";
import type { JSX } from "react";
import { useUpdateProfile } from "../../hooks/use-users.js";
import { useAuthStore } from "../../stores/auth.js";

interface EditProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useUpdateProfile();

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Profile"
      schema={editProfileSchema}
      defaultValues={{
        displayName: user?.displayName ?? "",
        status: user?.status ?? "",
        statusEmoji: user?.statusEmoji ?? "",
        pronouns: user?.pronouns ?? "",
        bio: user?.bio ?? "",
      }}
      onSubmit={async (data) => {
        const trimmed = {
          displayName: data.displayName?.trim() || null,
          status: data.status?.trim() || null,
          statusEmoji: data.statusEmoji?.trim() || null,
          pronouns: data.pronouns?.trim() || null,
          bio: data.bio?.trim() || null,
        };
        await updateProfile.mutateAsync(trimmed);
        onOpenChange(false);
      }}
      submitLabel="Save Changes"
      pendingLabel="Saving..."
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input placeholder={user?.username ?? "Display name"} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex gap-3">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Input placeholder="What are you up to?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusEmoji"
              render={({ field }) => (
                <FormItem className="w-20">
                  <FormLabel>Emoji</FormLabel>
                  <FormControl>
                    <Input placeholder="😊" className="text-center" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="pronouns"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pronouns</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. they/them" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell people about yourself"
                    className="min-h-[80px] resize-none"
                    maxLength={280}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {field.value?.length ?? 0}/280 · Supports markdown
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </ResponsiveFormModal>
  );
}
```

**Step 2: Verify the frontend compiles**

Run: `cd apps/web && pnpm check`

Expected: No type errors.

**Step 3: Commit**

```
feat(web): add bio, pronouns, and statusEmoji fields to edit profile dialog
```

---

## Task 8: Frontend — Add Popover Component to @cove/ui

**Files:**
- Create: `packages/ui/src/components/ui/popover.tsx`
- Modify: `packages/ui/src/index.ts`

The codebase uses `radix-ui` as a dependency which includes Popover. We need a thin wrapper following the existing pattern (see `tooltip.tsx` for reference).

**Step 1: Create the Popover component**

Create `packages/ui/src/components/ui/popover.tsx`:

```tsx
import { Popover as PopoverPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "../../lib/utils.js";

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 animate-in rounded-lg border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=closed]:animate-out",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

export { Popover, PopoverTrigger, PopoverContent };
```

**Step 2: Export from the UI package**

In `packages/ui/src/index.ts`, add after the Tooltip exports (line 99):

```typescript
export { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover.js";
```

**Step 3: Verify types compile**

Run: `cd packages/ui && pnpm check`

Expected: No type errors.

**Step 4: Commit**

```
feat(ui): add Popover component wrapping Radix UI Popover
```

---

## Task 9: Frontend — Build the Profile Card Component

**Files:**
- Create: `apps/web/src/components/layout/profile-card.tsx`
- Create: `apps/web/src/hooks/use-user-profile.ts`

**Step 1: Create the profile fetch hook**

Create `apps/web/src/hooks/use-user-profile.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["users", userId],
    queryFn: () => api.users.getUser(userId),
    staleTime: 60_000,
  });
}
```

**Step 2: Create the profile card component**

Create `apps/web/src/components/layout/profile-card.tsx`. This is a Popover that shows avatar, display name, username, pronouns, status with emoji, bio (rendered as markdown), and join date:

```tsx
import { Avatar, AvatarFallback, AvatarImage, Popover, PopoverContent, PopoverTrigger } from "@cove/ui";
import type { JSX, ReactNode } from "react";
import { useUserProfile } from "../../hooks/use-user-profile.js";
import { getUserAvatarUrl } from "../../lib/avatar.js";
import { MarkdownContent } from "../messages/markdown-content.js";

interface ProfileCardProps {
  readonly userId: string;
  readonly children: ReactNode;
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
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
      <PopoverTrigger asChild>{children}</PopoverTrigger>
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
              <Avatar className="size-16 shrink-0">
                <AvatarImage
                  src={user.avatarUrl ?? getUserAvatarUrl(String(user.id))}
                  alt={user.displayName ?? user.username}
                />
                <AvatarFallback className="bg-primary/20 text-primary text-lg">
                  {getInitials(user.displayName ?? user.username)}
                </AvatarFallback>
              </Avatar>
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
```

**Step 3: Verify the frontend compiles**

Run: `cd apps/web && pnpm check`

Expected: No type errors.

**Step 4: Commit**

```
feat(web): add ProfileCard popover and useUserProfile hook
```

---

## Task 10: Frontend — Wire Profile Card into Message Feed

**Files:**
- Modify: `apps/web/src/components/messages/message-item.tsx:184-205`

**Step 1: Add status emoji display and profile card trigger**

In `message-item.tsx`, import the `ProfileCard` component:

```typescript
import { ProfileCard } from "../layout/profile-card.js";
```

Then modify the author display section. In the `showAuthor` branch (around lines 184-205), wrap the avatar and username in a `ProfileCard`:

Replace the avatar block (lines 187-192):

```tsx
<ProfileCard userId={message.author.id}>
  <button type="button" className="mt-0.5 size-10 shrink-0 cursor-pointer">
    <Avatar className="size-10">
      <AvatarImage src={message.author.avatarUrl ?? getUserAvatarUrl(message.author.id)} alt={displayName} />
      <AvatarFallback className="bg-primary/20 text-primary text-xs">
        {getInitials(displayName)}
      </AvatarFallback>
    </Avatar>
  </button>
</ProfileCard>
```

Replace the username display (line 195):

```tsx
<ProfileCard userId={message.author.id}>
  <button type="button" className="cursor-pointer font-semibold text-foreground text-sm hover:underline">
    {displayName}
  </button>
</ProfileCard>
{message.author.statusEmoji && (
  <span className="text-sm" role="img">{message.author.statusEmoji}</span>
)}
```

**Step 2: Verify the frontend compiles**

Run: `cd apps/web && pnpm check`

Expected: No type errors.

**Step 3: Commit**

```
feat(web): wire ProfileCard into message items with status emoji display
```

---

## Task 11: Full Stack Verification

**Step 1: Run type checks across all packages**

Run: `pnpm -r check` (or `pnpm run check` in each package)

Expected: No type errors in any package.

**Step 2: Start the dev server and manually verify**

Run: `pnpm dev` (or however the dev server starts)

Verify:
- Edit profile dialog shows all five fields (display name, status, emoji, pronouns, bio)
- Saving profile updates persists all fields
- Bio character counter works
- Messages show status emoji next to the display name
- Clicking a username or avatar in chat opens the profile card popover
- Profile card shows avatar, display name, username, pronouns, status, bio, and join date
- Profile card handles loading and error states gracefully

**Step 3: Commit any fixes**

If any issues found during manual testing, fix and commit.

---

## Task 12: Final Commit — Feature Complete

**Step 1: Verify all changes**

Run: `git diff --stat master` to review the full changeset.

Expected files changed:
- `packages/shared/src/constants.ts`
- `packages/shared/src/validators.ts`
- `packages/shared/src/schemas.ts`
- `packages/db/src/schema/index.ts`
- `packages/db/drizzle/0002_*.sql` (generated migration)
- `packages/auth/src/middleware.ts`
- `packages/api-client/src/types.ts`
- `packages/api-client/src/resources/users.ts`
- `apps/api/src/routes/users.ts`
- `apps/api/src/routes/auth.ts`
- `apps/api/src/routes/messages.ts`
- `apps/web/src/components/layout/edit-profile-dialog.tsx`
- `apps/web/src/components/layout/profile-card.tsx` (new)
- `apps/web/src/hooks/use-user-profile.ts` (new)
- `packages/ui/src/components/ui/popover.tsx` (new)
- `packages/ui/src/index.ts`
- `apps/web/src/components/messages/message-item.tsx`

---

## Summary of Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| `statusEmoji` as separate column | Explicit, easy to validate, easy to render in different contexts |
| `statusEmoji` in `MessageAuthor`, not `bio`/`pronouns` | Emoji shows in chat; bio/pronouns are profile-only data |
| Radix Popover for profile card | Lightweight, accessible, follows existing Radix patterns |
| Plain text input for emoji (not a picker) | Zero new dependencies; users paste emoji naturally |
| Markdown rendering for bio via existing `MarkdownContent` | Reuses existing infrastructure, no new editor needed |
| `GET /users/:userId` excludes `email` | Privacy by default for public profile endpoint |
| `staleTime: 60_000` on profile query | Prevents hammering the API when clicking the same user repeatedly |
