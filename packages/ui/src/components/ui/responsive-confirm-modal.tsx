"use client";

import type { VariantProps } from "class-variance-authority";
import type { JSX, ReactNode } from "react";
import { useCallback, useState } from "react";

import { Button, type buttonVariants } from "./button.js";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "./responsive-modal.js";
import { SubmitButton } from "./submit-button.js";

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

interface ResponsiveConfirmModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: ReactNode;
  readonly onConfirm: () => Promise<void> | void;
  readonly confirmLabel?: string;
  readonly pendingLabel?: string;
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}

export function ResponsiveConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmLabel = "Confirm",
  pendingLabel = "Confirming...",
  variant = "default",
  disabled,
  children,
}: ResponsiveConfirmModalProps): JSX.Element {
  const [pending, setPending] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (pending) {
        return;
      }
      onOpenChange(next);
    },
    [pending, onOpenChange],
  );

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <ResponsiveModal open={open} onOpenChange={handleOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
        </ResponsiveModalHeader>
        {children && <div className="px-4 md:px-0">{children}</div>}
        <ResponsiveModalFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <SubmitButton
            type="button"
            variant={variant}
            pending={pending}
            pendingLabel={pendingLabel}
            disabled={disabled}
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </SubmitButton>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
