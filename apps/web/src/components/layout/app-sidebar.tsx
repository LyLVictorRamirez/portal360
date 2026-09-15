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
};

export function AppSidebar({ collapsed }: AppSidebarProps) {
  return (
    <aside
      className={`hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex ${collapsed ? "w-16" : "w-64"}`}
    >
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
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                <span className={collapsed ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
