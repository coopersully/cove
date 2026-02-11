import type { JSX } from "react";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router";
import { useAuthStore } from "../../stores/auth.js";

export function AuthGuard(): JSX.Element {
  const { user, isInitialized, initialize } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      void initialize();
    }
  }, [isInitialized, initialize]);

  if (!isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto size-10 animate-hearth-ember rounded-full bg-ember/80" />
          <p className="mt-6 font-display font-semibold text-foreground text-lg tracking-wide">
            Hearth
          </p>
          <p className="mt-1 font-body text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace={true} />;
  }

  return <Outlet />;
}
