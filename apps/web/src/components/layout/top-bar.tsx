"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../../lib/auth-client";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useSidebar } from "../ui/sidebar";

type TopBarProps = Readonly<{
  user: {
    email: string;
    name: string;
  };
}>;

export function TopBar({ user }: TopBarProps) {
  const router = useRouter();
  const { openMobile, state, toggleSidebar } = useSidebar();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const initials = getInitials(user.name);
  const collapsed = state === "collapsed";

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
        <Button
          aria-expanded={openMobile}
          aria-label="Abrir navegación"
          className="md:hidden"
          onClick={toggleSidebar}
          size="icon"
          variant="ghost"
        >
          <Menu aria-hidden="true" />
        </Button>
        <Button
          aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          className="hidden md:inline-flex"
          onClick={toggleSidebar}
          size="icon"
          variant="ghost"
        >
          {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </Button>
        <span aria-hidden="true" className="h-5 w-px bg-border" />
        <p className="text-sm font-semibold text-foreground">Inicio</p>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <p aria-live="polite" className="sr-only">
          {signOutError}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Abrir menú de ${user.name}`}
              className="h-11 max-w-[15rem] justify-start gap-3 px-2 text-left"
              variant="ghost"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-selected text-xs font-bold text-primary"
              >
                {initials}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-44 truncate text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="block max-w-44 truncate text-xs text-muted">{user.email}</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={isSigningOut} onSelect={() => void handleSignOut()}>
              {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
