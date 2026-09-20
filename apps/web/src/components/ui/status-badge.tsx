import type { HTMLAttributes } from "react";

import { Badge } from "./badge";

export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

type StatusBadgeProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  label: string;
  tone?: StatusBadgeTone;
};

const toneClassNames: Record<StatusBadgeTone, string> = {
  neutral: "border-border bg-surface-muted text-muted",
  info: "border-info/25 bg-info-surface text-info",
  success: "border-success/25 bg-success-surface text-success",
  warning: "border-warning/30 bg-warning-surface text-warning-foreground",
  danger: "border-danger/25 bg-danger-surface text-danger",
};

const dotClassNames: Record<StatusBadgeTone, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  success: "bg-success",
  warning: "bg-warning-foreground",
  danger: "bg-danger",
};

export function StatusBadge({ className, label, tone = "neutral", ...props }: StatusBadgeProps) {
  return (
    <Badge
      className={[
        "inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-semibold",
        toneClassNames[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span
        aria-hidden="true"
        className={["size-1.5 rounded-full", dotClassNames[tone]].join(" ")}
      />
      {label}
    </Badge>
  );
}
