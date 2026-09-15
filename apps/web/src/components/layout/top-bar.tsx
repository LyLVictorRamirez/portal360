import { ChevronDown, CircleUserRound, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { IconButton } from "../ui/icon-button";

type TopBarProps = {
  collapsed: boolean;
  onToggleSidebar: () => void;
};

export function TopBar({ collapsed, onToggleSidebar }: TopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6 lg:px-8">
      <div className="flex items-center gap-2">
        <IconButton
          className="hidden md:inline-flex"
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          label={collapsed ? "Expandir navegación" : "Contraer navegación"}
          onClick={onToggleSidebar}
        />
        <span className="text-sm font-medium text-foreground">Portal 360</span>
      </div>
      <button
        aria-haspopup="menu"
        className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        type="button"
      >
        <CircleUserRound aria-hidden="true" size={18} strokeWidth={1.75} />
        <span>Usuario</span>
        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
      </button>
    </header>
  );
}
