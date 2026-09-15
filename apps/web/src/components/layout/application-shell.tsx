"use client";

import { useEffect, useState, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

type ApplicationShellProps = Readonly<{
  children: ReactNode;
}>;

const SIDEBAR_STORAGE_KEY = "portal-360:sidebar-collapsed";

export function ApplicationShell({ children }: ApplicationShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      setIsSidebarCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    } catch {
      // Keep the default expanded state when storage is unavailable.
    }
  }, []);

  function toggleSidebar() {
    setIsSidebarCollapsed((currentValue) => {
      const nextValue = !currentValue;

      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
      } catch {
        // The interface remains usable when storage is unavailable.
      }

      return nextValue;
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar collapsed={isSidebarCollapsed} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar collapsed={isSidebarCollapsed} onToggleSidebar={toggleSidebar} />
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
