"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../lib/auth-client";
import { IconButton } from "../ui/icon-button";
import { Menu as ActionMenu, type MenuItem } from "../ui/menu";

type TopBarProps = Readonly<{
  collapsed: boolean;
  mobileSidebarOpen: boolean;
  onOpenMobileSidebar: () => void;
  onToggleSidebar: () => void;
  user: {
    email: string;
    name: string;
  };
}>;

export function TopBar({
  collapsed,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onToggleSidebar,
  user,
}: TopBarProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const initials = getInitials(user.name);
  const menuItems: readonly MenuItem[] = [
    isSigningOut
      ? {
          disabled: true,
          id: "signing-out",
          label: "Cerrando sesión…",
        }
      : {
          id: "sign-out",
          label: "Cerrar sesión",
          onSelectAction: handleSignOut,
        },
  ];

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError(null);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setSignOutError("No fue posible cerrar la sesión. Inténtalo de nuevo.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("No fue posible cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center border-b border-border bg-surface px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <IconButton
          aria-controls="mobile-sidebar"
          aria-expanded={mobileSidebarOpen}
          className="md:hidden"
          icon={Menu}
          label="Abrir navegación"
          onClick={onOpenMobileSidebar}
        />
        <IconButton
          className="hidden md:inline-flex"
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          onClick={onToggleSidebar}
        />
        <span aria-hidden="true" className="h-5 w-px bg-border" />
        <p className="text-sm font-semibold text-foreground">Inicio</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <p aria-live="polite" className="sr-only">
          {signOutError}
        </p>
        <ActionMenu
          items={menuItems}
          label={`Abrir menú de ${user.name}`}
          trigger={
            <>
              <span
                aria-hidden="true"
                className="flex size-7 items-center justify-center rounded-full bg-surface-selected text-xs font-bold text-primary"
              >
                {initials}
              </span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-44 truncate text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="block max-w-44 truncate text-xs text-muted">{user.email}</span>
              </span>
            </>
          }
          triggerClassName="max-w-[15rem]"
        />
      </div>
    </header>
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return initials || "U";
}
