import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils.js";
import { Button } from "./button.js";
import { Input } from "./input.js";

function PasswordInput({
  className,
  ref,
  visible,
  onVisibleChange,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
}) {
  const [internalVisible, setInternalVisible] = React.useState(false);

  const isControlled = visible !== undefined;
  const showPassword = isControlled ? visible : internalVisible;

  const toggle = () => {
    if (isControlled) {
      onVisibleChange?.(!visible);
    } else {
      setInternalVisible((prev) => !prev);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={showPassword ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute top-0 right-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={toggle}
        tabIndex={-1}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <EyeIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeOffIcon className="size-4" aria-hidden="true" />
        )}
      </Button>
      {/* Hide native browser password toggle */}
      <style>{`
        .hide-password-toggle::-ms-reveal,
        .hide-password-toggle::-ms-clear {
          visibility: hidden;
          pointer-events: none;
          display: none;
        }
      `}</style>
    </div>
  );
}

export { PasswordInput };
