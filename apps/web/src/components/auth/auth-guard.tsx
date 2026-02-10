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
      <div className="flex h-screen items-center justify-center bg-warm-white">
        <div className="text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-4 border-ember border-t-transparent" />
          <p className="mt-4 font-body text-warm-gray">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace={true} />;
  }

  return <Outlet />;
}
