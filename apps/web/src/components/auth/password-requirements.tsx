import { MIN_PASSWORD_LENGTH } from "@hearth/shared";
import { cn } from "@hearth/ui";
import { Check, Circle } from "lucide-react";
import type { JSX } from "react";

interface Requirement {
  label: string;
  met: boolean;
}

function getRequirements(password: string): Requirement[] {
  return [
    {
      label: `At least ${String(MIN_PASSWORD_LENGTH)} characters`,
      met: password.length >= MIN_PASSWORD_LENGTH,
    },
    { label: "Contains a lowercase letter", met: /[a-z]/.test(password) },
    { label: "Contains an uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains a number", met: /\d/.test(password) },
  ];
}

interface PasswordRequirementsProps {
  readonly password: string;
}

export function PasswordRequirements({ password }: PasswordRequirementsProps): JSX.Element | null {
  if (!password) {
    return null;
  }

  const requirements = getRequirements(password);
  const metCount = requirements.filter((r) => r.met).length;
  const allMet = metCount === requirements.length;

  return (
    <div className="animate-fade-up-in space-y-2" role="status" aria-label="Password requirements">
      {/* Progress bar */}
      <div className="flex gap-1">
        {requirements.map((req) => (
          <div
            key={req.label}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              req.met ? (allMet ? "bg-emerald-500" : "bg-amber-500") : "bg-muted",
            )}
          />
        ))}
      </div>

      {/* Requirements checklist */}
      <ul className="space-y-1">
        {requirements.map((req) => (
          <li key={req.label} className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "flex items-center justify-center transition-all duration-300",
                req.met ? "text-emerald-500" : "text-muted-foreground",
              )}
            >
              {req.met ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <Circle className="size-3" />
              )}
            </span>
            <span
              className={cn(
                "transition-colors duration-300",
                req.met ? "text-emerald-500" : "text-muted-foreground",
              )}
            >
              {req.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function arePasswordRequirementsMet(password: string): boolean {
  return getRequirements(password).every((r) => r.met);
}
