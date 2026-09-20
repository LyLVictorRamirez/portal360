import type { HTMLAttributes } from "react";

import { Card } from "./card";

type SurfaceTone = "default" | "muted" | "raised";
type SurfacePadding = "none" | "sm" | "md";

type SurfaceProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "onClick" | "onKeyDown" | "onKeyUp" | "role" | "tabIndex"
> & {
  padding?: SurfacePadding;
  tone?: SurfaceTone;
};

const toneClassNames: Record<SurfaceTone, string> = {
  default: "border border-border bg-surface",
  muted: "border border-border bg-surface-muted",
  raised: "border border-border bg-surface-raised shadow-sm",
};

const paddingClassNames: Record<SurfacePadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
};

export function Surface({ className, padding = "none", tone = "default", ...props }: SurfaceProps) {
  return (
    <Card
      className={["rounded-md", toneClassNames[tone], paddingClassNames[padding], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
