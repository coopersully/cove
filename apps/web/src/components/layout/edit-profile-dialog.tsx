import { editProfileSchema } from "@cove/shared";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ResponsiveFormModal,
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
      }}
      onSubmit={async (data) => {
        const trimmedName = data.displayName?.trim();
        const trimmedStatus = data.status?.trim();
        await updateProfile.mutateAsync({
          displayName: trimmedName || null,
          status: trimmedStatus || null,
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
