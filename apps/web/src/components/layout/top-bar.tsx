import { ChevronDown, CircleUserRound } from "lucide-react";

export function TopBar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6 lg:px-8">
      <span className="text-sm font-medium text-foreground">Portal 360</span>
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
