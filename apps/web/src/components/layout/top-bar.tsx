import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { IconButton } from "../ui/icon-button";

type TopBarProps = Readonly<{
  collapsed: boolean;
  mobileSidebarOpen: boolean;
  onOpenMobileSidebar: () => void;
  onToggleSidebar: () => void;
}>;

export function TopBar({
  collapsed,
  mobileSidebarOpen,
  onOpenMobileSidebar,
  onToggleSidebar,
}: TopBarProps) {
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
    </header>
  );
}
