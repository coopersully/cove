import type { JSX } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AuthGuard } from "./components/auth/auth-guard.js";
import { AppLayout } from "./components/layout/app-layout.js";
import { ServerView } from "./components/server/server-view.js";
import { LoginPage } from "./pages/login.js";
import { RegisterPage } from "./pages/register.js";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/servers" replace={true} />} />
          <Route path="/servers" element={<ServerListPlaceholder />} />
          <Route path="/servers/:serverId" element={<ServerView />} />
          <Route path="/servers/:serverId/channels/:channelId" element={<ServerView />} />
        </Route>
      </Route>
    </Routes>
  );
}

function ServerListPlaceholder(): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center text-driftwood">
      <div className="text-center">
        <h2 className="font-display font-semibold text-linen text-xl">Welcome to Hearth</h2>
        <p className="mt-2 text-sm">Select a server or create a new one to get started.</p>
      </div>
    </div>
  );
}
