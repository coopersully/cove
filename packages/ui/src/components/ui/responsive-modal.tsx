"use client";

import * as React from "react";

import { useMediaQuery } from "../../hooks/use-media-query.js";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog.js";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "./drawer.js";

const DESKTOP_QUERY = "(min-width: 768px)";

const DesktopContext = React.createContext(true);

function useIsDesktop() {
  return React.useContext(DesktopContext);
}

// ── Root ────────────────────────────────────────────────────────────────────

interface ResponsiveModalProps {
  readonly children: React.ReactNode;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

function ResponsiveModal({ children, ...props }: ResponsiveModalProps) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  return (
    <DesktopContext.Provider value={isDesktop}>
      {isDesktop ? <Dialog {...props}>{children}</Dialog> : <Drawer {...props}>{children}</Drawer>}
    </DesktopContext.Provider>
  );
}

// ── Trigger ─────────────────────────────────────────────────────────────────

function ResponsiveModalTrigger({ ...props }: React.ComponentProps<typeof DialogTrigger>) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogTrigger {...props} /> : <DrawerTrigger {...props} />;
}

// ── Close ───────────────────────────────────────────────────────────────────

function ResponsiveModalClose({ ...props }: React.ComponentProps<typeof DialogClose>) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogClose {...props} /> : <DrawerClose {...props} />;
}

// ── Content ─────────────────────────────────────────────────────────────────

function ResponsiveModalContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <DialogContent className={className} {...props}>
        {children}
      </DialogContent>
    );
  }

  return <DrawerContent className={className}>{children}</DrawerContent>;
}

// ── Header ──────────────────────────────────────────────────────────────────

function ResponsiveModalHeader({ ...props }: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogHeader {...props} /> : <DrawerHeader {...props} />;
}

// ── Footer ──────────────────────────────────────────────────────────────────

function ResponsiveModalFooter({ ...props }: React.ComponentProps<"div">) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogFooter {...props} /> : <DrawerFooter {...props} />;
}

// ── Title ───────────────────────────────────────────────────────────────────

function ResponsiveModalTitle({ ...props }: React.ComponentProps<typeof DialogTitle>) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogTitle {...props} /> : <DrawerTitle {...props} />;
}

// ── Description ─────────────────────────────────────────────────────────────

function ResponsiveModalDescription({ ...props }: React.ComponentProps<typeof DialogDescription>) {
  const isDesktop = useIsDesktop();
  return isDesktop ? <DialogDescription {...props} /> : <DrawerDescription {...props} />;
}

export {
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalTrigger,
};
