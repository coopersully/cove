import type { JSX } from "react";
import { Outlet } from "react-router";
import { useGateway } from "../../hooks/use-gateway.js";
import { useIsMobile } from "../../hooks/use-is-mobile.js";
import { MobileLayout } from "../mobile/mobile-layout.js";
import { ServerSidebar } from "./server-sidebar.js";

export function AppLayout(): JSX.Element {
  useGateway();
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <ServerSidebar />
      <Outlet />
    </div>
  );
}
