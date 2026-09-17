"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

type ApplicationShellProps = Readonly<{
  children: ReactNode;
}>;

const SIDEBAR_STORAGE_KEY = "portal-360:sidebar-collapsed";

function getSidebarCollapsedPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function applySidebarCollapsedPreference(isCollapsed: boolean) {
  document.documentElement.dataset.sidebarCollapsed = String(isCollapsed);
}

export function ApplicationShell({ children }: ApplicationShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const mobileSidebarOpenerRef = useRef<HTMLElement | null>(null);
  const wasMobileSidebarOpenRef = useRef(false);

  useLayoutEffect(() => {
    const collapsedPreference = getSidebarCollapsedPreference();
    setIsSidebarCollapsed(collapsedPreference);
    applySidebarCollapsedPreference(collapsedPreference);
  }, []);

  useEffect(() => {
    if (!isMobileSidebarOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 48rem)");
    const closeAtDesktopWidth = () => {
      if (desktopViewport.matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    desktopViewport.addEventListener("change", closeAtDesktopWidth);

    return () => desktopViewport.removeEventListener("change", closeAtDesktopWidth);
  }, []);

  useEffect(() => {
    if (isMobileSidebarOpen) {
      wasMobileSidebarOpenRef.current = true;
      return;
    }

    if (!wasMobileSidebarOpenRef.current) return;

    wasMobileSidebarOpenRef.current = false;
    const opener = mobileSidebarOpenerRef.current;
    mobileSidebarOpenerRef.current = null;
    const animationFrame = window.requestAnimationFrame(() => {
      if (opener?.isConnected) {
        opener.focus({ preventScroll: true });
      }
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [isMobileSidebarOpen]);

  function closeMobileSidebar() {
    setIsMobileSidebarOpen(false);
  }

  function openMobileSidebar() {
    mobileSidebarOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsMobileSidebarOpen(true);
  }

  function toggleSidebar() {
    const nextValue = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextValue);
    applySidebarCollapsedPreference(nextValue);

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextValue));
    } catch {
      // The interface remains usable when storage is unavailable.
    }
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      <AppSidebar
        collapsed={isSidebarCollapsed}
        mobileOpen={isMobileSidebarOpen}
        onMobileClose={closeMobileSidebar}
      />
      <div
        aria-hidden={isMobileSidebarOpen || undefined}
        className="flex min-w-0 flex-1 flex-col"
        inert={isMobileSidebarOpen}
      >
        <TopBar
          collapsed={isSidebarCollapsed}
          mobileSidebarOpen={isMobileSidebarOpen}
          onOpenMobileSidebar={openMobileSidebar}
          onToggleSidebar={toggleSidebar}
        />
        <main className="min-w-0 flex-1 px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
