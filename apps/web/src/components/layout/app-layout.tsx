import type { JSX } from "react";
import { Outlet } from "react-router";
import { ServerSidebar } from "./server-sidebar.js";

export function AppLayout(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden bg-surface text-linen">
      <ServerSidebar />
      <Outlet />
    </div>
  );
}
