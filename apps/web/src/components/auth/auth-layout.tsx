import { WifiOff } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useApiHealth } from "../../hooks/use-api-health.js";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  const { isReachable, isChecking } = useApiHealth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linen px-6 py-12 dark:bg-charcoal">
      {/* Brand header */}
      <div className="mb-8 text-center">
        <h1 className="animate-brand-enter font-bold font-display text-3xl text-charcoal tracking-[0.14em] dark:text-warm-white">
          Hearth
        </h1>
        <p
          className="mt-2 animate-fade-up-in font-body text-driftwood text-sm"
          style={{ animationDelay: "0.15s" }}
        >
          The place people gather.
        </p>
      </div>

      {!(isChecking || isReachable) && (
        <div className="mb-6 flex w-full max-w-sm items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          <WifiOff className="size-4 shrink-0" />
          <p>Unable to reach the server. Some features may be unavailable.</p>
        </div>
      )}

      {children}
    </div>
  );
}
