import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AuthGuard } from "./components/auth/auth-guard.js";
import { AppLayout } from "./components/layout/app-layout.js";
import { Logo } from "./components/logo.js";
import { ServerView } from "./components/server/server-view.js";
import { useDocumentTitle } from "./hooks/use-document-title.js";
import { ForgotPasswordPage } from "./pages/forgot-password.js";
import { LoginPage } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";
import { ResetPasswordPage } from "./pages/reset-password.js";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/servers" replace={true} />} />
          <Route path="/servers" element={<ServerListPlaceholder />} />
          <Route path="/servers/:serverId" element={<ServerView />} />
          <Route path="/servers/:serverId/channels/:channelId" element={<ServerView />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace={true} />} />
    </Routes>
  );
}

function ServerListPlaceholder(): JSX.Element {
  useDocumentTitle("Servers");
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="animate-fade-up-in text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
          <Logo className="size-8 text-primary" />
        </div>
        <h2 className="font-display font-semibold text-foreground text-xl">Welcome to Cove</h2>
        <p className="mt-2 max-w-xs font-body text-sm">
          Select a server or create a new one to get started.
        </p>
      </div>
    </div>
  );
}
