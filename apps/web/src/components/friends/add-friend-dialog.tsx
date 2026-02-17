import { sendFriendRequestSchema } from "@cove/shared";
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
import { useSendFriendRequest } from "../../hooks/use-friends.js";

interface AddFriendDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function AddFriendDialog({ open, onOpenChange }: AddFriendDialogProps): JSX.Element {
  const sendRequest = useSendFriendRequest();

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Friend"
      description="Send a friend request by username."
      schema={sendFriendRequestSchema}
      defaultValues={{ username: "" }}
      onSubmit={async (data) => {
        await sendRequest.mutateAsync({ username: data.username });
        onOpenChange(false);
      }}
      submitLabel="Send Request"
      pendingLabel="Sending..."
    >
      {(form) => (
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="Enter a username" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </ResponsiveFormModal>
  );
}
