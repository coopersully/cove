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
