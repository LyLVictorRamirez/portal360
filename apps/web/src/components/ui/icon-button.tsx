import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon: LucideIcon;
  label: string;
};

export function IconButton({
  className,
  icon: Icon,
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      className={`inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 ${className ?? ""}`}
      type={type}
      {...props}
    >
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
      <span className="sr-only">{label}</span>
    </button>
  );
}
