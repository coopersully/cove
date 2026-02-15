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
