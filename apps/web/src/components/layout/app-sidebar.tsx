import Link from "next/link";
import { Home } from "lucide-react";

const primaryNavigation = [
  {
    href: "/",
    icon: Home,
    label: "Inicio",
  },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link className="text-sm font-semibold tracking-tight text-foreground" href="/">
          Portal 360
        </Link>
      </div>
      <nav aria-label="Navegación principal" className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {primaryNavigation.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link
                aria-current="page"
                className="flex h-9 items-center gap-3 rounded-md bg-surface-muted px-3 text-sm font-medium text-foreground"
                href={href}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
