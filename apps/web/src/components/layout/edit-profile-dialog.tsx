import { editProfileSchema } from "@cove/shared";
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ResponsiveFormModal,
  Textarea,
} from "@cove/ui";
import { SmilePlus, X } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { useUpdateProfile } from "../../hooks/use-users.js";
import { useAuthStore } from "../../stores/auth.js";
import { UserAvatar } from "../user-avatar.js";

interface EditProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function StatusEmojiPicker({
  value,
  onChange,
}: { readonly value: string; readonly onChange: (value: string) => void }): JSX.Element {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild={true}>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border bg-background text-lg transition-colors hover:bg-accent"
          >
            {value || <SmilePlus className="size-4 text-muted-foreground" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-fit p-0" align="start">
          <EmojiPicker
            className="h-[342px]"
            onEmojiSelect={({ emoji }) => {
              onChange(emoji);
              setPickerOpen(false);
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Clear emoji"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
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
        avatarUrl: user?.avatarUrl ?? "",
        status: user?.status ?? "",
        statusEmoji: user?.statusEmoji ?? "",
        pronouns: user?.pronouns ?? "",
        bio: user?.bio ?? "",
      }}
      onSubmit={async (data) => {
        const trimmed = {
          displayName: data.displayName?.trim() || null,
          avatarUrl: data.avatarUrl?.trim() || null,
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
            name="avatarUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar</FormLabel>
                <div className="flex items-center gap-3">
                  <UserAvatar
                    user={{
                      id: user?.id ?? "",
                      avatarUrl: field.value || null,
                      displayName: user?.displayName,
                      username: user?.username ?? "",
                    }}
                    size="xl"
                  />
                  <div className="flex-1">
                    <FormControl>
                      <Input placeholder="https://example.com/avatar.png" {...field} />
                    </FormControl>
                    <FormDescription>Paste an image URL</FormDescription>
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
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
              name="statusEmoji"
              render={({ field }) => (
                <FormItem className="shrink-0">
                  <FormLabel>Emoji</FormLabel>
                  <StatusEmojiPicker value={field.value ?? ""} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              )}
            />
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
