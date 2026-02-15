import { Separator } from "@hearth/ui";
import type { JSX, ReactNode } from "react";

interface AuthLayoutProps {
  readonly children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps): JSX.Element {
  return (
    <div className="flex min-h-screen">
      {/* Decorative left panel */}
      <div className="relative hidden w-1/2 overflow-hidden bg-charcoal lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Layered warm gradient orbs */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(250,250,247,0.08) 0%, transparent 70%), " +
              "radial-gradient(ellipse 60% 80% at 70% 60%, rgba(242,240,235,0.06) 0%, transparent 65%), " +
              "radial-gradient(ellipse 50% 50% at 50% 40%, rgba(226,223,216,0.04) 0%, transparent 60%)",
          }}
        />
        {/* Animated glow center */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 45% 55%, rgba(250,250,247,0.06) 0%, transparent 50%)",
            animation: "hearth-glow 6s ease-in-out infinite",
          }}
        />
        {/* Secondary drifting orb */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 60% 35%, rgba(226,223,216,0.05) 0%, transparent 40%)",
            animation: "hearth-drift 10s ease-in-out infinite",
          }}
        />
        {/* Subtle grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Brand content */}
        <div className="relative z-10 flex flex-col items-center px-12 text-center">
          <h1 className="animate-brand-enter font-bold font-display text-6xl text-warm-white tracking-[0.14em]">
            Hearth
          </h1>
          <Separator className="mx-auto mt-6 w-12 bg-warm-white/25" />
          <p
            className="mt-6 max-w-xs animate-fade-up-in font-body text-driftwood text-lg leading-relaxed"
            style={{ animationDelay: "0.3s" }}
          >
            The place people gather.
          </p>
        </div>

        {/* Bottom decorative line */}
        <div className="absolute right-0 bottom-0 left-0 h-px bg-gradient-to-r from-transparent via-warm-white/15 to-transparent" />
      </div>

      {/* Form panel */}
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 lg:w-1/2">
        {/* Mobile-only brand header */}
        <div className="mb-10 text-center lg:hidden">
          <h1 className="font-bold font-display text-3xl text-foreground tracking-wide">Hearth</h1>
          <p className="mt-1 font-body text-muted-foreground text-sm">The place people gather.</p>
        </div>

        {children}
      </div>
    </div>
  );
}
