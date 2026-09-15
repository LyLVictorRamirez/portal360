import Link from "next/link";
import { Home, PanelsTopLeft } from "lucide-react";

const primaryNavigation = [
  {
    href: "/",
    icon: Home,
    label: "Inicio",
  },
];

type AppSidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

type SidebarContentProps = {
  collapsed: boolean;
  onNavigate?: () => void;
};

function SidebarContent({ collapsed, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div
        className={`flex h-16 items-center border-b border-border ${collapsed ? "justify-center" : "px-5"}`}
      >
        <Link
          aria-label="Portal 360"
          className={`flex items-center gap-3 text-sm font-semibold tracking-tight text-foreground ${collapsed ? "justify-center" : ""}`}
          href="/"
        >
          <PanelsTopLeft aria-hidden="true" size={18} strokeWidth={1.75} />
          <span className={collapsed ? "sr-only" : undefined}>Portal 360</span>
        </Link>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {primaryNavigation.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link
                aria-current="page"
                aria-label={collapsed ? label : undefined}
                className={`flex h-9 items-center rounded-md bg-surface-muted text-sm font-medium text-foreground ${collapsed ? "justify-center px-0" : "gap-3 px-3"}`}
                href={href}
                onClick={onNavigate}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                <span className={collapsed ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

export function AppSidebar({ collapsed, mobileOpen, onMobileClose }: AppSidebarProps) {
  return (
    <>
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex ${collapsed ? "w-16" : "w-64"}`}
      >
        <SidebarContent collapsed={collapsed} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            aria-label="Cerrar navegación"
            className="absolute inset-0 bg-foreground/20"
            onClick={onMobileClose}
            type="button"
          />
          <aside
            aria-label="Navegación principal"
            aria-modal="true"
            className="relative flex h-full w-72 flex-col border-r border-border bg-surface shadow-lg"
            id="mobile-sidebar"
            role="dialog"
          >
            <SidebarContent collapsed={false} onNavigate={onMobileClose} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
