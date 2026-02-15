# Form Architecture Standardization

## Problem

10+ forms across auth and dialog components all use raw `useState` for every field, manual validation, duplicated error display markup, and no form library. Each form reinvents state management, error handling, and loading state patterns.

## Decisions

- Full Zod schemas in `@hearth/shared`, shared between frontend and API
- All dialog forms use `ResponsiveModal` consistently (mobile drawer + desktop dialog)
- A composed `ResponsiveFormModal` wrapper handles common dialog form layout
- react-hook-form + shadcn Form primitives for all form state management

## Architecture

### 1. Form Schemas — `@hearth/shared/src/schemas.ts`

Compose existing field validators (`emailSchema`, `passwordSchema`, etc. from `validators.ts`) into form-level schemas:

- `loginSchema` — email + password
- `registerSchema` — username + email + password + confirmPassword (with refine for match)
- `forgotPasswordSchema` — email
- `resetPasswordSchema` — password + confirmPassword (with refine)
- `createServerSchema` — name + optional description
- `joinServerSchema` — serverId
- `editProfileSchema` — optional displayName + optional status
- `createChannelSchema` — name + type + optional topic
- `editChannelSchema` — name + optional topic
- `serverSettingsSchema` — name + optional description

Shared between frontend (react-hook-form zodResolver) and API (Hono request validation).

### 2. New Components in `@hearth/ui`

**Dependencies:** `react-hook-form` (peer dep), `@hookform/resolvers` (dep)

**a) shadcn Form primitives** (`form.tsx`)
- `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`
- Wraps react-hook-form's `FormProvider` and `Controller`
- `FormMessage` auto-displays field-level validation errors

**b) `FormAlert`** (`form-alert.tsx`)
- Replaces the copy-pasted AlertTriangle error banner (used in all 4 auth forms)
- Props: `message: string | null`, `variant?: "error" | "success"`
- Renders nothing when message is null

**c) `SubmitButton`** (`submit-button.tsx`)
- Button with built-in loading spinner
- Props: `pending: boolean`, `pendingLabel?: string`, plus standard Button props
- Eliminates the repeated ternary + spinner pattern

**d) `ResponsiveFormModal`** (`responsive-form-modal.tsx`)
- Generic component parameterized by form schema type
- Creates `useForm` instance internally with `zodResolver`
- Props: `open`, `onOpenChange`, `title`, `description?`, `schema`, `defaultValues`, `onSubmit`, `submitLabel?`, `pendingLabel?`, `children: (form) => ReactNode`
- Handles: ResponsiveModal wrapping, header/footer layout, cancel button, submit loading state, form reset on close, server error display via FormAlert

### 3. Auth Forms (Card layout)

Auth forms don't use modals but still benefit from:
- `useForm` + `zodResolver` replacing all `useState` calls
- `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` for field layout
- `FormAlert` for error/success banners
- `SubmitButton` for loading state
- `PasswordRequirements` stays as-is (form-specific visual feedback)

### 4. File Inventory

**New files:**
- `packages/shared/src/schemas.ts`
- `packages/ui/src/components/ui/form.tsx`
- `packages/ui/src/components/ui/form-alert.tsx`
- `packages/ui/src/components/ui/submit-button.tsx`
- `packages/ui/src/components/ui/responsive-form-modal.tsx`

**Modified files:**
- `packages/shared/src/index.ts` — export schemas
- `packages/ui/src/index.ts` — export new components
- `packages/ui/package.json` — add deps
- `apps/web/package.json` — add react-hook-form dep
- 6 dialog forms — refactor to ResponsiveFormModal
- 4 auth forms — refactor to useForm + shadcn primitives + FormAlert + SubmitButton

### 5. Zod 4 Compatibility

`@hearth/shared` uses Zod 4 (`^4.3.6`). Must verify `@hookform/resolvers` zodResolver works with Zod 4 during implementation. If not, use the Zod 4-specific resolver or a thin adapter.
