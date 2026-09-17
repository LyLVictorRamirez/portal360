import type { HTMLAttributes } from "react";

import { StatusBadge, type StatusBadgeTone } from "./status-badge";

export type WorkListPriorityTone = "high" | "medium" | "low";

export type WorkListItem = {
  context: string;
  id: string;
  priority: {
    label: string;
    tone: WorkListPriorityTone;
  };
  responsible: string;
  status: {
    label: string;
    tone: StatusBadgeTone;
  };
  title: string;
};

type WorkListProps = Omit<HTMLAttributes<HTMLUListElement>, "aria-label" | "children"> & {
  items: readonly WorkListItem[];
  label: string;
};

const priorityClassNames: Record<WorkListPriorityTone, string> = {
  high: "text-warning-foreground",
  medium: "text-foreground",
  low: "text-muted",
};

const priorityDotClassNames: Record<WorkListPriorityTone, string> = {
  high: "bg-warning-foreground",
  medium: "bg-foreground",
  low: "bg-muted",
};

export function WorkList({ className, items, label, ...props }: WorkListProps) {
  return (
    <ul
      aria-label={label}
      className={["divide-y divide-border border-y border-border", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {items.map(({ context, id, priority, responsible, status, title }) => (
        <li
          key={id}
          className="grid min-h-11 gap-x-5 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
        >
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold leading-5 text-foreground">{title}</p>
            <p className="break-words text-xs leading-5 text-muted">{context}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:justify-self-end">
            <StatusBadge label={status.label} tone={status.tone} />
            <span
              className={[
                "inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold",
                priorityClassNames[priority.tone],
              ].join(" ")}
            >
              <span
                aria-hidden="true"
                className={["size-1.5 rounded-full", priorityDotClassNames[priority.tone]].join(
                  " ",
                )}
              />
              Prioridad {priority.label}
            </span>
          </div>
          <p className="text-sm leading-5 text-muted md:text-right">
            <span className="text-muted-subtle">Responsable: </span>
            {responsible}
          </p>
        </li>
      ))}
    </ul>
  );
}
