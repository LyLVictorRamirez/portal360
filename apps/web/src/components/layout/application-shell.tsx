"use client";

import { useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import type { AuthorizationPermission } from "../../lib/authorization";

type ApplicationShellProps = Readonly<{
  children: ReactNode;
  permissions: readonly AuthorizationPermission[];
  user: {
    email: string;
    name: string;
  };
}>;

const SIDEBAR_STORAGE_KEY = "portal-360:sidebar-collapsed";

function getSidebarCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function ApplicationShell({ children, permissions, user }: ApplicationShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useLayoutEffect(() => {
    setSidebarOpen(!getSidebarCollapsedPreference());
  }, []);

  function handleSidebarOpenChange(open: boolean) {
    setSidebarOpen(open);

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!open));
    } catch {
      // The navigation remains usable when storage is unavailable.
    }
  }

  return (
    <SidebarProvider
      onOpenChange={handleSidebarOpenChange}
      open={sidebarOpen}
      persist={false}
      style={{ "--sidebar-width": "17.5rem", "--sidebar-width-icon": "4.5rem" } as CSSProperties}
    >
      <AppSidebar permissions={permissions} />
      <SidebarInset className="bg-canvas">
        <TopBar user={user} />
        <div className="min-w-0 flex-1 px-6 py-8 lg:px-8">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
