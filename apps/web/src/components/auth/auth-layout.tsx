import type { JSX, ReactNode } from "react";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
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

      {children}
    </div>
  );
}
