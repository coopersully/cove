# UserAvatar Component Design

## Problem

User avatar styling is duplicated across 5+ files with inconsistent fallback backgrounds (`bg-primary/10` vs `bg-primary/20`), inconsistent container treatment, and repeated initials logic. The sidebar avatar looks correct because it wraps the avatar in a `bg-background` circular container — other locations (chat, profile card, mobile) render the avatar bare.

## Solution

Create a shared `UserAvatar` component that encapsulates avatar rendering with a consistent `bg-background` container, standardized fallback styling, and size variants.

## Component API

```tsx
interface UserAvatarProps {
  user: { id: string; avatarUrl?: string | null; displayName?: string | null; username: string };
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}
```

## Size Variants

| Size | Container | Avatar | Text | Used in |
|---|---|---|---|---|
| `sm` | `size-8` | `size-7` | `text-xs` | Mobile top bar |
| `default` | `size-10` | `size-8` | `text-xs` | User section sidebar |
| `lg` | `size-12` | `size-10` | `text-xs` | Desktop sidebar, chat messages |
| `xl` | `size-18` | `size-16` | `text-lg` | Profile card |

## Rendering

- Outer `div` with `rounded-full bg-background flex items-center justify-center` + container size
- Inner `Avatar` with avatar size
- `AvatarFallback` standardized to `bg-primary/10 text-primary` + text size
- Initials: `(displayName ?? username).slice(0, 2).toUpperCase()`

## Files Changed

1. **Create** `apps/web/src/components/user-avatar.tsx`
2. **Update** `server-sidebar.tsx` — UserButton
3. **Update** `message-item.tsx` — MessageItem
4. **Update** `profile-card.tsx` — ProfileCard
5. **Update** `mobile-top-bar.tsx` — MobileUserButton
6. **Update** `user-section.tsx` — UserSection
