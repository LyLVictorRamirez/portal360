type Portal360MarkProps = Readonly<{
  className?: string;
  compact?: boolean;
  size?: "sm" | "md";
}>;

const symbolSizes = {
  sm: "size-7",
  md: "size-9",
};

export function Portal360Mark({ className, compact = false, size = "md" }: Portal360MarkProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        aria-hidden="true"
        className={`${symbolSizes[size]} shrink-0 text-primary`}
        fill="none"
        viewBox="0 0 32 32"
      >
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          strokeDasharray="20 5"
          strokeLinecap="round"
          strokeWidth="3.5"
          transform="rotate(-90 16 16)"
        />
        <circle cx="16" cy="16" fill="currentColor" r="2.25" />
      </svg>
      <span
        data-portal-360-wordmark
        className={compact ? "sr-only" : "text-sm font-semibold tracking-tight text-foreground"}
      >
        Portal 360
      </span>
    </span>
  );
}
