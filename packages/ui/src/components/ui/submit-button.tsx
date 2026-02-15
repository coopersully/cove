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
