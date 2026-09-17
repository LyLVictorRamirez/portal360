import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";

type IconButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type IconButtonSize = "sm" | "md" | "lg";

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "children"> & {
  icon: LucideIcon;
  label: string;
  size?: IconButtonSize;
  variant?: IconButtonVariant;
};

const baseClassName =
  "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const sizeClassNames: Record<IconButtonSize, string> = {
  sm: "size-10",
  md: "size-11",
  lg: "size-12",
};

const variantClassNames: Record<IconButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  quiet: "text-muted hover:bg-surface-muted hover:text-foreground",
  danger: "bg-danger text-primary-foreground shadow-sm hover:opacity-90",
};

export function IconButton({
  className,
  icon: Icon,
  label,
  size = "sm",
  type = "button",
  variant = "quiet",
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={[baseClassName, sizeClassNames[size], variantClassNames[variant], className]
        .filter(Boolean)
        .join(" ")}
      type={type}
      {...props}
    >
      <Icon
        aria-hidden="true"
        size={size === "sm" ? 18 : size === "md" ? 20 : 22}
        strokeWidth={1.75}
      />
    </button>
  );
}
