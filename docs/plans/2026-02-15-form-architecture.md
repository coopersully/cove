# Form Architecture Standardization — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace ad-hoc form state management with react-hook-form + Zod schemas + shared UI components across all 10 forms.

**Architecture:** Shared Zod schemas in `@cove/shared`, shadcn Form primitives + `FormAlert` + `SubmitButton` + `ResponsiveFormModal` in `@cove/ui`, all forms refactored to use these.

**Tech Stack:** react-hook-form, @hookform/resolvers, zod (v4, already installed), shadcn/ui Form component

---

### Task 1: Install dependencies and verify Zod 4 compatibility

**Files:**
- Modify: `packages/ui/package.json`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml` (auto)

**Step 1: Install react-hook-form and @hookform/resolvers**

```bash
cd /Users/cooper/conductor/workspaces/cove/sun-valley
pnpm --filter @cove/ui add react-hook-form @hookform/resolvers
pnpm --filter @cove/web add react-hook-form @hookform/resolvers
```

Note: `@cove/ui` needs these as dependencies since `ResponsiveFormModal` calls `useForm` internally. `apps/web` also needs them for auth forms which call `useForm` directly. `zod` is already available transitively via `@cove/shared`.

**Step 2: Verify Zod 4 compatibility**

The project uses Zod 4 (`^4.3.6`). Test that `zodResolver` works by checking the installed version of `@hookform/resolvers`. If it uses `@hookform/resolvers/zod`, verify it exports a working resolver. If Zod 4 requires a different import path (e.g., `@hookform/resolvers/zod4`), adjust accordingly.

```bash
cd /Users/cooper/conductor/workspaces/cove/sun-valley
node -e "const { zodResolver } = await import('@hookform/resolvers/zod'); console.log('zodResolver:', typeof zodResolver);"
```

Expected: `zodResolver: function`

If this fails, check for a Zod 4-specific resolver path or use `zod/v3-compat` if needed.

**Step 3: Commit**

```bash
git add packages/ui/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore: add react-hook-form and @hookform/resolvers dependencies"
```

---

### Task 2: Create form schemas in `@cove/shared`

**Files:**
- Create: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create schemas file**

Create `packages/shared/src/schemas.ts` composing existing field validators into form-level schemas:

```typescript
import { z } from "zod";

import {
  channelNameSchema,
  channelTopicSchema,
  channelTypeSchema,
  displayNameSchema,
  emailSchema,
  passwordSchema,
  serverDescriptionSchema,
  serverNameSchema,
  snowflakeSchema,
  statusSchema,
  usernameSchema,
} from "./validators.js";

// ── Auth Schemas ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ── Server Schemas ──────────────────────────────────────────────────────────

export const createServerSchema = z.object({
  name: serverNameSchema,
  description: serverDescriptionSchema.optional(),
});

export const joinServerSchema = z.object({
  serverId: snowflakeSchema,
});

export const serverSettingsSchema = z.object({
  name: serverNameSchema,
  description: serverDescriptionSchema.optional(),
});

// ── Channel Schemas ─────────────────────────────────────────────────────────

export const createChannelSchema = z.object({
  name: channelNameSchema,
  type: channelTypeSchema,
});

export const editChannelSchema = z.object({
  name: channelNameSchema,
  topic: channelTopicSchema.optional(),
});

// ── User Schemas ────────────────────────────────────────────────────────────

export const editProfileSchema = z.object({
  displayName: displayNameSchema.optional(),
  status: statusSchema.optional(),
});
```

**Step 2: Export schemas from barrel**

Add to `packages/shared/src/index.ts`:

```typescript
export * from "./schemas.js";
```

**Step 3: Verify types compile**

```bash
cd /Users/cooper/conductor/workspaces/cove/sun-valley
pnpm --filter @cove/shared run check
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/index.ts
git commit -m "feat(shared): add composed form schemas for all forms"
```

---

### Task 3: Create shadcn Form primitives in `@cove/ui`

**Files:**
- Create: `packages/ui/src/components/ui/form.tsx`

**Step 1: Create the shadcn Form component**

Create `packages/ui/src/components/ui/form.tsx`. This is the standard shadcn Form component adapted for the project. It wraps react-hook-form's `FormProvider`, `Controller`, and `useFormContext` with accessible label/error wiring:

```typescript
"use client";

import * as React from "react";
import type {
  ControllerProps,
  FieldPath,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import { Controller, FormProvider, useFormContext } from "react-hook-form";

import { Label } from "./label.js";
import { cn } from "../../lib/utils.js";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  const fieldState = getFieldState(fieldContext.name, formState);

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn("space-y-2", className)} {...props} />
    </FormItemContext.Provider>
  );
}

function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  const { error, formItemId } = useFormField();

  return (
    <Label
      className={cn(error && "text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  );
}

function FormControl({ ...props }: React.ComponentProps<"slot">) {
  const { error, formItemId, formDescriptionId, formMessageId } =
    useFormField();

  return (
    <slot
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
}

function FormDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField();

  return (
    <p
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function FormMessage({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message) : children;

  if (!body) {
    return null;
  }

  return (
    <p
      id={formMessageId}
      className={cn("text-destructive text-sm", className)}
      {...props}
    >
      {body}
    </p>
  );
}

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
```

**Important:** The `FormControl` component uses a `<slot>` element. This is the shadcn pattern — the child input component receives the `id`, `aria-describedby`, and `aria-invalid` props through React's slot mechanism. The consuming input must spread these props. If `<slot>` causes issues with the project's JSX config, replace it with `<Slot>` from `@radix-ui/react-slot` (already a dependency).

**Step 2: Verify it compiles**

```bash
pnpm --filter @cove/ui run check
```

If there are type issues with `<slot>`, switch to Radix `Slot`:
```typescript
import { Slot } from "@radix-ui/react-slot";
// Replace <slot> with <Slot> in FormControl
```

---

### Task 4: Create FormAlert component

**Files:**
- Create: `packages/ui/src/components/ui/form-alert.tsx`

**Step 1: Create the component**

Create `packages/ui/src/components/ui/form-alert.tsx`:

```typescript
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { JSX } from "react";

import { cn } from "../../lib/utils.js";

interface FormAlertProps {
  readonly message: string | null;
  readonly variant?: "error" | "success";
  readonly className?: string;
}

export function FormAlert({ message, variant = "error", className }: FormAlertProps): JSX.Element | null {
  if (!message) {
    return null;
  }

  const isError = variant === "error";
  const Icon = isError ? AlertTriangle : CheckCircle;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border border-l-[3px] px-3 py-2.5 text-sm",
        isError
          ? "border-destructive/20 border-l-destructive bg-destructive/10 text-destructive"
          : "border-emerald-500/20 border-l-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        className,
      )}
      role="alert"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
```

---

### Task 5: Create SubmitButton component

**Files:**
- Create: `packages/ui/src/components/ui/submit-button.tsx`

**Step 1: Create the component**

Create `packages/ui/src/components/ui/submit-button.tsx`:

```typescript
import type { JSX } from "react";

import { Button } from "./button.js";

interface SubmitButtonProps extends React.ComponentProps<typeof Button> {
  readonly pending?: boolean;
  readonly pendingLabel?: string;
}

export function SubmitButton({
  pending = false,
  pendingLabel = "Submitting...",
  children,
  disabled,
  ...props
}: SubmitButtonProps): JSX.Element {
  return (
    <Button type="submit" disabled={disabled || pending} {...props}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
```

---

### Task 6: Create ResponsiveFormModal component

**Files:**
- Create: `packages/ui/src/components/ui/responsive-form-modal.tsx`

**Step 1: Create the component**

Create `packages/ui/src/components/ui/responsive-form-modal.tsx`:

```typescript
"use client";

import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";
import type { DefaultValues, FieldValues, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { ZodType } from "zod";

import { FormAlert } from "./form-alert.js";
import { SubmitButton } from "./submit-button.js";
import { Button } from "./button.js";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./responsive-modal.js";
import { Form } from "./form.js";

// Import dynamically to handle Zod 4 compat — zodResolver uses safeParse internally.
// @hookform/resolvers/zod works with both Zod 3 and Zod 4 since they share the safeParse API.
import { zodResolver } from "@hookform/resolvers/zod";

interface ResponsiveFormModalProps<T extends FieldValues> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly schema: ZodType<T>;
  readonly defaultValues: DefaultValues<T>;
  readonly onSubmit: (data: T) => Promise<void>;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  readonly children: (form: UseFormReturn<T>) => ReactNode;
  readonly trigger?: ReactNode;
}

export function ResponsiveFormModal<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  pendingLabel = "Saving...",
  children,
  trigger,
}: ResponsiveFormModalProps<T>): JSX.Element {
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        form.reset();
        setServerError(null);
      }
      onOpenChange(next);
    },
    [form, onOpenChange],
  );

  const handleSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      await onSubmit(data);
      form.reset();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("An unexpected error occurred");
      }
    }
  });

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      {trigger}
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          {description && (
            <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
          )}
        </ResponsiveModalHeader>
        <Form {...form}>
          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
            <FormAlert message={serverError} />
            {children(form)}
            <ResponsiveModalFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <SubmitButton pending={form.formState.isSubmitting} pendingLabel={pendingLabel}>
                {submitLabel}
              </SubmitButton>
            </ResponsiveModalFooter>
          </form>
        </Form>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
```

**Key design decisions:**
- `serverError` state handles API errors (things Zod can't catch). Field-level errors are handled automatically by `FormMessage`.
- `form.reset()` on close ensures clean state when reopening.
- `handleSubmit` wraps `form.handleSubmit` to catch async errors from the `onSubmit` callback.
- The `trigger` prop is optional — some dialogs manage their own trigger externally (e.g., CreateChannelDialog uses `ResponsiveModalTrigger`).
- Uses `Error.message` for error display — this works with `ApiError` since it extends `Error`.

---

### Task 7: Update `@cove/ui` barrel exports

**Files:**
- Modify: `packages/ui/src/index.ts`

**Step 1: Add exports for all new components**

Add these exports to `packages/ui/src/index.ts`:

```typescript
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from "./components/ui/form.js";
export { FormAlert } from "./components/ui/form-alert.js";
export { SubmitButton } from "./components/ui/submit-button.js";
export { ResponsiveFormModal } from "./components/ui/responsive-form-modal.js";
```

**Step 2: Verify full build**

```bash
pnpm --filter @cove/ui run check
```

**Step 3: Commit all new UI components**

```bash
git add packages/ui/src/components/ui/form.tsx packages/ui/src/components/ui/form-alert.tsx packages/ui/src/components/ui/submit-button.tsx packages/ui/src/components/ui/responsive-form-modal.tsx packages/ui/src/index.ts
git commit -m "feat(ui): add Form primitives, FormAlert, SubmitButton, and ResponsiveFormModal"
```

---

### Task 8: Refactor CreateServerDialog

**Files:**
- Modify: `apps/web/src/components/layout/create-server-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

Replace the entire file with:

```typescript
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal, Tooltip, TooltipContent, TooltipTrigger } from "@cove/ui";
import { createServerSchema } from "@cove/shared";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useCreateServer } from "../../hooks/use-servers.js";

export function CreateServerDialog(): JSX.Element {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const createServer = useCreateServer();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild={true}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="group relative flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            aria-label="Create server"
          >
            <Plus className="size-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Create Server
        </TooltipContent>
      </Tooltip>
      <ResponsiveFormModal
        open={open}
        onOpenChange={setOpen}
        title="Create a server"
        description="Give your server a name and start building your community."
        schema={createServerSchema}
        defaultValues={{ name: "", description: "" }}
        onSubmit={async (data) => {
          const result = await createServer.mutateAsync({
            name: data.name,
            description: data.description || undefined,
          });
          setOpen(false);
          void navigate(`/servers/${result.server.id}`);
        }}
        submitLabel="Create"
        pendingLabel="Creating..."
      >
        {(form) => (
          <>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Server name</FormLabel>
                  <FormControl>
                    <Input placeholder="My awesome server" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="What's your server about?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </ResponsiveFormModal>
    </>
  );
}
```

**Step 2: Verify it compiles**

```bash
pnpm --filter @cove/web run check
```

---

### Task 9: Refactor JoinServerDialog

**Files:**
- Modify: `apps/web/src/components/layout/join-server-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

```typescript
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal } from "@cove/ui";
import { joinServerSchema } from "@cove/shared";
import type { JSX } from "react";
import { useNavigate } from "react-router";
import { useJoinServer } from "../../hooks/use-servers.js";

interface JoinServerDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function JoinServerDialog({ open, onOpenChange }: JoinServerDialogProps): JSX.Element {
  const joinServer = useJoinServer();
  const navigate = useNavigate();

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Join a Server"
      description="Enter a server ID or invite code to join a server."
      schema={joinServerSchema}
      defaultValues={{ serverId: "" }}
      onSubmit={async (data) => {
        await joinServer.mutateAsync({ serverId: data.serverId });
        onOpenChange(false);
        void navigate(`/servers/${data.serverId}`);
      }}
      submitLabel="Join Server"
      pendingLabel="Joining..."
    >
      {(form) => (
        <FormField
          control={form.control}
          name="serverId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server ID</FormLabel>
              <FormControl>
                <Input placeholder="Enter server ID" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </ResponsiveFormModal>
  );
}
```

---

### Task 10: Refactor EditProfileDialog

**Files:**
- Modify: `apps/web/src/components/layout/edit-profile-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

```typescript
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal } from "@cove/ui";
import { editProfileSchema } from "@cove/shared";
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
      }}
      onSubmit={async (data) => {
        const trimmedName = data.displayName?.trim();
        const trimmedStatus = data.status?.trim();
        await updateProfile.mutateAsync({
          ...(trimmedName ? { displayName: trimmedName } : {}),
          ...(trimmedStatus ? { status: trimmedStatus } : {}),
        });
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
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <FormControl>
                  <Input placeholder="What are you up to?" {...field} />
                </FormControl>
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

**Note:** `defaultValues` uses the current user data. When the modal opens after user data changes, the form will initialize with stale defaults from the first render. If this is a problem, add a `key={user?.id}` on `ResponsiveFormModal` to force remount, or use `form.reset()` in a `useEffect` watching `open`. This is an edge case — evaluate during testing.

---

### Task 11: Refactor CreateChannelDialog

**Files:**
- Modify: `apps/web/src/components/server/create-channel-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

```typescript
import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
} from "@cove/ui";
import { createChannelSchema } from "@cove/shared";
import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useCreateChannel } from "../../hooks/use-channels.js";

interface CreateChannelDialogProps {
  readonly serverId: string;
}

export function CreateChannelDialog({ serverId }: CreateChannelDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const createChannel = useCreateChannel(serverId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        title="Create Channel"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
      </Button>
      <ResponsiveFormModal
        open={open}
        onOpenChange={setOpen}
        title="Create a channel"
        description="Channels are where conversations happen."
        schema={createChannelSchema}
        defaultValues={{ name: "", type: "text" as const }}
        onSubmit={async (data) => {
          await createChannel.mutateAsync({
            name: data.name.toLowerCase().replaceAll(" ", "-"),
            type: data.type,
          });
          setOpen(false);
        }}
        submitLabel="Create"
        pendingLabel="Creating..."
      >
        {(form) => (
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel name</FormLabel>
                <FormControl>
                  <Input placeholder="general" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </ResponsiveFormModal>
    </>
  );
}
```

**Note:** The `type` field defaults to `"text"` and is hidden from the UI (matches current behavior). The `channel-name` is lowercased and hyphenated on submit, same as before.

---

### Task 12: Refactor EditChannelDialog

**Files:**
- Modify: `apps/web/src/components/server/edit-channel-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

```typescript
import type { Channel } from "@cove/api-client";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal } from "@cove/ui";
import { editChannelSchema } from "@cove/shared";
import type { JSX } from "react";
import { useUpdateChannel } from "../../hooks/use-channels.js";

interface EditChannelDialogProps {
  readonly channel: Channel;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function EditChannelDialog({
  channel,
  open,
  onOpenChange,
}: EditChannelDialogProps): JSX.Element {
  const updateChannel = useUpdateChannel(channel.serverId);

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Channel"
      schema={editChannelSchema}
      defaultValues={{
        name: channel.name,
        topic: channel.topic ?? "",
      }}
      onSubmit={async (data) => {
        const trimmedName = data.name.trim().toLowerCase().replace(/\s+/g, "-");
        await updateChannel.mutateAsync({
          channelId: channel.id,
          data: {
            name: trimmedName,
            topic: data.topic?.trim() || null,
          },
        });
        onOpenChange(false);
      }}
      submitLabel="Save Changes"
      pendingLabel="Saving..."
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Channel name</FormLabel>
                <FormControl>
                  <Input placeholder="channel-name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="topic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topic</FormLabel>
                <FormControl>
                  <Input placeholder="What is this channel about?" {...field} />
                </FormControl>
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

---

### Task 13: Refactor ServerSettingsDialog

**Files:**
- Modify: `apps/web/src/components/server/server-settings-dialog.tsx`

**Step 1: Rewrite using ResponsiveFormModal**

```typescript
import type { Server } from "@cove/api-client";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, Input, ResponsiveFormModal } from "@cove/ui";
import { serverSettingsSchema } from "@cove/shared";
import type { JSX } from "react";
import { useUpdateServer } from "../../hooks/use-servers.js";

interface ServerSettingsDialogProps {
  readonly server: Server;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function ServerSettingsDialog({
  server,
  open,
  onOpenChange,
}: ServerSettingsDialogProps): JSX.Element {
  const updateServer = useUpdateServer(server.id);

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Server Settings"
      schema={serverSettingsSchema}
      defaultValues={{
        name: server.name,
        description: server.description ?? "",
      }}
      onSubmit={async (data) => {
        await updateServer.mutateAsync({
          name: data.name.trim(),
          description: data.description?.trim() || null,
        });
        onOpenChange(false);
      }}
      submitLabel="Save Changes"
      pendingLabel="Saving..."
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server name</FormLabel>
                <FormControl>
                  <Input placeholder="My Server" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Input placeholder="What is this server about?" {...field} />
                </FormControl>
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

**Step 2: Commit all dialog refactors**

```bash
git add apps/web/src/components/layout/create-server-dialog.tsx apps/web/src/components/layout/join-server-dialog.tsx apps/web/src/components/layout/edit-profile-dialog.tsx apps/web/src/components/server/create-channel-dialog.tsx apps/web/src/components/server/edit-channel-dialog.tsx apps/web/src/components/server/server-settings-dialog.tsx
git commit -m "refactor: migrate all dialog forms to ResponsiveFormModal"
```

---

### Task 14: Refactor LoginForm

**Files:**
- Modify: `apps/web/src/components/auth/login-form.tsx`

**Step 1: Rewrite using react-hook-form + shared components**

```typescript
import { ApiError } from "@cove/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormAlert,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PasswordInput,
  SubmitButton,
} from "@cove/ui";
import { loginSchema } from "@cove/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import type { z } from "zod";
import { useAuthStore } from "../../stores/auth.js";

export function LoginForm(): JSX.Element {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      await login(data.email, data.password);
      void navigate("/");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your Cove account</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="login-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoFocus={true}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Password</FormLabel>
                      <Link
                        to="/forgot-password"
                        className="text-muted-foreground text-xs underline-offset-4 hover:text-primary hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <FormControl>
                      <PasswordInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <SubmitButton
          form="login-form"
          pending={form.formState.isSubmitting}
          pendingLabel="Signing in..."
          className="w-full"
        >
          Sign in
        </SubmitButton>
        <div className="text-muted-foreground text-sm">
          Don&apos;t have an account?{" "}
          <Link to="/register" className="text-primary underline-offset-4 hover:underline">
            Sign up
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
```

**Key changes:**
- All `useState` for fields replaced by `useForm`
- `FormAlert` replaces the AlertTriangle error div
- `SubmitButton` replaces the loading spinner ternary
- `FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` replace manual label/input wiring
- Field-level validation errors now display automatically via `FormMessage`

**Important:** `PasswordInput` must accept and forward the `ref` and `value`/`onChange` props that react-hook-form's `field` spread provides. Verify `PasswordInput` uses `React.forwardRef` or accepts a `ref` prop. If not, wrap it or update the component.

---

### Task 15: Refactor RegisterForm

**Files:**
- Modify: `apps/web/src/components/auth/register-form.tsx`

**Step 1: Rewrite using react-hook-form + shared components**

```typescript
import { ApiError } from "@cove/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormAlert,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PasswordInput,
  SubmitButton,
} from "@cove/ui";
import { registerSchema } from "@cove/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import type { z } from "zod";
import { useAuthStore } from "../../stores/auth.js";
import { PasswordRequirements } from "./password-requirements.js";

export function RegisterForm(): JSX.Element {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const password = form.watch("password");

  async function onSubmit(data: z.infer<typeof registerSchema>) {
    setError(null);
    try {
      await register(data.username, data.email, data.password);
      void navigate("/");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <CardTitle className="font-display text-2xl">Create an account</CardTitle>
        <CardDescription>Join Cove and start the conversation</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="register-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="johndoe" autoFocus={true} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <PasswordRequirements password={password} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <SubmitButton
          form="register-form"
          pending={form.formState.isSubmitting}
          disabled={!form.formState.isValid}
          pendingLabel="Creating account..."
          className="w-full"
        >
          Create account
        </SubmitButton>
        <div className="text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-primary underline-offset-4 hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
```

**Key notes:**
- `mode: "onChange"` enables real-time validation (needed for PasswordRequirements + confirm password matching)
- `form.watch("password")` feeds the `PasswordRequirements` component
- The `.refine()` on `registerSchema` handles confirm password matching — `FormMessage` on the `confirmPassword` field will display "Passwords do not match" automatically
- Manual `arePasswordRequirementsMet` check is no longer needed — Zod schema handles it

---

### Task 16: Refactor ForgotPasswordForm

**Files:**
- Modify: `apps/web/src/components/auth/forgot-password-form.tsx`

**Step 1: Rewrite using react-hook-form + shared components**

```typescript
import { ApiError } from "@cove/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormAlert,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  SubmitButton,
} from "@cove/ui";
import { forgotPasswordSchema } from "@cove/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Mail } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import type { z } from "zod";
import { api } from "../../lib/api.js";

export function ForgotPasswordForm(): JSX.Element {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<z.infer<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: z.infer<typeof forgotPasswordSchema>) {
    setError(null);
    try {
      await api.auth.forgotPassword({ email: data.email });
      setSubmittedEmail(data.email);
      setSubmitted(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (submitted) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="size-6 text-emerald-500" />
          </div>
          <CardTitle className="font-display text-2xl">Check your email</CardTitle>
          <CardDescription>
            If an account exists for <strong>{submittedEmail}</strong>, we&apos;ve sent a password
            reset link.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Link to="/login" className="text-primary text-sm underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <CardTitle className="text-center font-display text-2xl">Forgot password?</CardTitle>
        <CardDescription className="text-center">
          Enter your email and we&apos;ll send you a reset link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="forgot-password-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoFocus={true}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <SubmitButton
          form="forgot-password-form"
          pending={form.formState.isSubmitting}
          pendingLabel="Sending..."
          className="w-full"
        >
          Send reset link
        </SubmitButton>
        <Link
          to="/login"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
```

**Note:** Stored the submitted email in state (`submittedEmail`) since `form` values are cleared after submit. The original used the `email` state variable directly.

---

### Task 17: Refactor ResetPasswordForm

**Files:**
- Modify: `apps/web/src/components/auth/reset-password-form.tsx`

**Step 1: Rewrite using react-hook-form + shared components**

```typescript
import { ApiError } from "@cove/api-client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Form,
  FormAlert,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  PasswordInput,
  SubmitButton,
} from "@cove/ui";
import { resetPasswordSchema } from "@cove/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle, KeyRound } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";
import { api } from "../../lib/api.js";
import { PasswordRequirements } from "./password-requirements.js";

export function ResetPasswordForm(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [validating, setValidating] = useState(!!token);
  const [showPasswords, setShowPasswords] = useState(false);

  const form = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const password = form.watch("password");

  useEffect(() => {
    if (!token) {
      return;
    }

    api.auth.validateResetToken({ token }).then(
      (res) => {
        setTokenValid(res.valid);
        setValidating(false);
      },
      () => {
        setTokenValid(false);
        setValidating(false);
      },
    );
  }, [token]);

  async function onSubmit(data: z.infer<typeof resetPasswordSchema>) {
    setError(null);
    try {
      await api.auth.resetPassword({ token: token!, password: data.password });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    }
  }

  if (validating) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
          <CardTitle className="font-display text-2xl">Verifying link</CardTitle>
          <CardDescription>Checking your password reset link...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!token || tokenValid === false) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <CardTitle className="font-display text-2xl">Invalid link</CardTitle>
          <CardDescription>This password reset link is invalid or has expired.</CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Link
            to="/forgot-password"
            className="text-primary text-sm underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="w-full max-w-sm animate-fade-up-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="size-6 text-emerald-500" />
          </div>
          <CardTitle className="font-display text-2xl">Password reset</CardTitle>
          <CardDescription>
            Your password has been successfully updated. You can now sign in with your new password.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex-col gap-2">
          <Button asChild={true} className="w-full">
            <Link to="/login">Sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm animate-fade-up-in">
      <CardHeader>
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRound className="size-6 text-primary" />
        </div>
        <CardTitle className="text-center font-display text-2xl">Reset password</CardTitle>
        <CardDescription className="text-center">Enter your new password below.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form id="reset-password-form" onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}>
            <div className="flex flex-col gap-6">
              <FormAlert message={error} />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <PasswordRequirements password={password} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm new password</FormLabel>
                    <FormControl>
                      <PasswordInput
                        {...field}
                        visible={showPasswords}
                        onVisibleChange={setShowPasswords}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-2">
        <SubmitButton
          form="reset-password-form"
          pending={form.formState.isSubmitting}
          disabled={!form.formState.isValid}
          pendingLabel="Resetting..."
          className="w-full"
        >
          Reset password
        </SubmitButton>
      </CardFooter>
    </Card>
  );
}
```

**Step 2: Commit all auth form refactors**

```bash
git add apps/web/src/components/auth/login-form.tsx apps/web/src/components/auth/register-form.tsx apps/web/src/components/auth/forgot-password-form.tsx apps/web/src/components/auth/reset-password-form.tsx
git commit -m "refactor: migrate all auth forms to react-hook-form with Zod validation"
```

---

### Task 18: Verify PasswordInput ref forwarding

**Files:**
- Possibly modify: `packages/ui/src/components/ui/password-input.tsx`

**Step 1: Check if PasswordInput forwards ref**

Read `packages/ui/src/components/ui/password-input.tsx` and verify it uses `React.forwardRef` (or React 19's ref-as-prop pattern). react-hook-form's `field` spread includes a `ref` that must reach the underlying `<input>`.

If it doesn't forward ref, update it to do so. This is critical — without ref forwarding, react-hook-form can't focus fields on validation error.

**Step 2: Full type check and lint**

```bash
pnpm run check
pnpm run lint
```

Fix any errors.

**Step 3: Final commit**

```bash
git add -A
git commit -m "fix: ensure PasswordInput forwards ref for react-hook-form compatibility"
```

---

### Task 19: Clean up — remove unused imports

**Step 1: Check for dead imports**

After all refactors, run biome lint to catch unused imports:

```bash
pnpm run lint:fix
```

This will auto-remove unused imports across all modified files.

**Step 2: Verify the full build**

```bash
pnpm run check
pnpm run lint
```

**Step 3: Commit cleanup**

```bash
git add -A
git commit -m "chore: clean up unused imports after form refactor"
```
