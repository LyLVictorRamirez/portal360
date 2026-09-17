import type { HTMLAttributes, ReactNode } from "react";

export type DataTableAlignment = "left" | "center" | "right";

export type DataTableColumn<Row> = {
  align?: DataTableAlignment;
  cell: (row: Row) => ReactNode;
  header: string;
  id: string;
};

type DataTableProps<Row extends { id: string }> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "role" | "tabIndex"
> & {
  columns: readonly DataTableColumn<Row>[];
  label: string;
  rows: readonly Row[];
};

const alignmentClassNames: Record<DataTableAlignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<Row extends { id: string }>({
  className,
  columns,
  label,
  rows,
  ...props
}: DataTableProps<Row>) {
  return (
    <div
      aria-label={`Tabla desplazable: ${label}`}
      className={[
        "w-full overflow-x-auto overscroll-x-contain border-y border-border bg-surface",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="region"
      tabIndex={0}
      {...props}
    >
      <table className="min-w-2xl w-full border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-muted">
          <tr>
            {columns.map(({ align = "left", header, id }) => (
              <th
                key={id}
                scope="col"
                className={[
                  "whitespace-nowrap border-b border-border px-4 py-3 text-xs font-semibold text-muted",
                  alignmentClassNames[align],
                ].join(" ")}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface">
          {rows.map((row, rowIndex) => (
            <tr key={row.id}>
              {columns.map(({ align = "left", cell, id }) => (
                <td
                  key={id}
                  className={[
                    "wrap-break-word px-4 py-3 text-sm leading-5 text-foreground",
                    rowIndex < rows.length - 1 ? "border-b border-border" : "",
                    alignmentClassNames[align],
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
