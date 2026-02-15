import { WifiOff } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { useApiHealth } from "../../hooks/use-api-health.js";
import { Logo } from "../logo.js";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  const { isReachable, isChecking } = useApiHealth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-linen px-6 py-12 dark:bg-charcoal">
      {/* Brand header */}
      <div className="mb-8 flex animate-brand-enter items-center gap-2.5 text-charcoal dark:text-warm-white">
        <Logo className="size-8" />
        <span className="font-display font-semibold text-2xl leading-none">Cove</span>
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
