import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@hearth/ui";
import type { JSX } from "react";
import { useState } from "react";
import { useUpdateProfile } from "../../hooks/use-users.js";
import { useAuthStore } from "../../stores/auth.js";

interface EditProfileDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [status, setStatus] = useState(user?.status ?? "");
  const updateProfile = useUpdateProfile();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedStatus = status.trim();
    updateProfile.mutate(
      {
        ...(trimmedName ? { displayName: trimmedName } : {}),
        ...(trimmedStatus ? { status: trimmedStatus } : {}),
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              placeholder={user?.username ?? "Display name"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-status">Status</Label>
            <Input
              id="user-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              maxLength={128}
              placeholder="What are you up to?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
