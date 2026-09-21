"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useMemo, type HTMLAttributes, type ReactNode } from "react";

import { DataTable as TanstackDataTable } from "./table/data-table";

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

/**
 * Compatibility boundary for Portal 360 lists. Its callers retain their domain-oriented column
 * declarations while rendering through the starter's TanStack Table implementation.
 */
export function DataTable<Row extends { id: string }>({
  className,
  columns,
  label,
  rows,
  ...props
}: DataTableProps<Row>) {
  const data = useMemo(() => [...rows], [rows]);
  const tableColumns = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((column) => ({
        cell: ({ row }) => column.cell(row.original),
        header: column.header,
        id: column.id,
        meta: { align: column.align },
      })),
    [columns],
  );
  const table = useReactTable({
    columns: tableColumns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <TanstackDataTable
      aria-label={`Tabla desplazable: ${label}`}
      className={className}
      showPagination={false}
      table={table}
      {...props}
    />
  );
}
