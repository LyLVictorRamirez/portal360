"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { IconButton } from "../ui/icon-button";
import { Portal360Mark } from "../ui/portal-360-mark";

const primaryNavigation = [
  {
    href: "/",
    icon: Home,
    label: "Inicio",
  },
];

type AppSidebarProps = Readonly<{
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
}>;

type SidebarContentProps = Readonly<{
  collapsed: boolean;
  onMobileClose?: () => void;
  onNavigate?: () => void;
}>;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => element.tabIndex >= 0,
  );
}

function isCurrentRoute(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ collapsed, onMobileClose, onNavigate }: SidebarContentProps) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={`flex min-h-20 items-center border-b border-border ${
          collapsed ? "justify-center px-3" : "justify-between px-5"
        }`}
      >
        <Link
          aria-label={collapsed ? "Portal 360" : undefined}
          className="inline-flex rounded-sm"
          href="/"
          onClick={onNavigate}
        >
          <Portal360Mark compact={collapsed} size="md" />
        </Link>
        {onMobileClose ? (
          <IconButton
            data-mobile-sidebar-close="true"
            icon={X}
            label="Cerrar navegación"
            onClick={onMobileClose}
          />
        ) : null}
      </div>
      <nav aria-label="Navegación principal" className="flex-1 px-3 py-5">
        <ul className="space-y-1">
          {primaryNavigation.map(({ href, icon: Icon, label }) => {
            const isActive = isCurrentRoute(pathname, href);

            return (
              <li key={href}>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  className={`flex h-11 items-center rounded-r-md border-l-2 text-sm font-medium transition-colors duration-150 ${
                    collapsed ? "justify-center px-0" : "gap-3 px-4"
                  } ${
                    isActive
                      ? "border-primary bg-surface-selected text-foreground"
                      : "border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                  href={href}
                  onClick={onNavigate}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                  <span className={collapsed ? "sr-only" : undefined}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function AppSidebar({ collapsed, mobileOpen, onMobileClose }: AppSidebarProps) {
  const mobilePanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const animationFrame = window.requestAnimationFrame(() => {
      mobilePanelRef.current
        ?.querySelector<HTMLElement>("[data-mobile-sidebar-close]")
        ?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [mobileOpen]);

  function handleMobilePanelKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onMobileClose();
      return;
    }

    if (event.key !== "Tab") return;

    const mobilePanel = mobilePanelRef.current;
    if (!mobilePanel) return;

    const focusableElements = getFocusableElements(mobilePanel);
    if (focusableElements.length === 0) {
      event.preventDefault();
      mobilePanel.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (
      event.shiftKey &&
      (activeElement === firstElement || !mobilePanel.contains(activeElement))
    ) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
    }

    if (
      !event.shiftKey &&
      (activeElement === lastElement || !mobilePanel.contains(activeElement))
    ) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  }

  return (
    <>
      <aside
        aria-label="Navegación principal"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex ${
          collapsed ? "w-[4.5rem]" : "w-[17.5rem]"
        }`}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Cerrar navegación"
            className="absolute inset-0 bg-foreground/20"
            onClick={onMobileClose}
            tabIndex={-1}
            type="button"
          />
          <aside
            aria-labelledby="mobile-sidebar-title"
            aria-modal="true"
            className="relative flex h-full w-[min(18rem,calc(100vw-3rem))] flex-col border-r border-border bg-surface shadow-md"
            id="mobile-sidebar"
            onKeyDown={handleMobilePanelKeyDown}
            ref={mobilePanelRef}
            role="dialog"
            tabIndex={-1}
          >
            <h2 className="sr-only" id="mobile-sidebar-title">
              Navegación principal
            </h2>
            <SidebarContent
              collapsed={false}
              onMobileClose={onMobileClose}
              onNavigate={onMobileClose}
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}
