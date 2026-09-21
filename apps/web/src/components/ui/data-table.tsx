"use client";

import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { useMemo, useState, type HTMLAttributes, type ReactNode } from "react";

import { DataTableColumnHeader } from "./table/data-table-column-header";
import { DataTable as TanstackDataTable } from "./table/data-table";
import { DataTableViewOptions } from "./table/data-table-view-options";

export type DataTableAlignment = "left" | "center" | "right";

export type DataTableColumn<Row> = {
  align?: DataTableAlignment;
  cell: (row: Row) => ReactNode;
  header: string;
  hideable?: boolean;
  id: string;
  sortValue?: (row: Row) => string | number;
};

type DataTableProps<Row extends { id: string }> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "role" | "tabIndex"
> & {
  columns: readonly DataTableColumn<Row>[];
  label: string;
  rows: readonly Row[];
  scrollable?: boolean;
  showViewOptions?: boolean;
  toolbar?: ReactNode;
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
  scrollable = false,
  showViewOptions = false,
  toolbar,
  ...props
}: DataTableProps<Row>) {
  const data = useMemo(() => [...rows], [rows]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [sorting, setSorting] = useState<SortingState>([]);
  const tableColumns = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((column) => ({
        accessorFn: column.sortValue,
        cell: ({ row }) => column.cell(row.original),
        enableHiding: column.hideable,
        enableSorting: Boolean(column.sortValue),
        header: ({ column: tableColumn }) =>
          column.sortValue || column.hideable ? (
            <DataTableColumnHeader column={tableColumn} title={column.header} />
          ) : (
            column.header
          ),
        id: column.id,
        meta: { align: column.align, label: column.header },
      })),
    [columns],
  );
  const table = useReactTable({
    columns: tableColumns,
    data,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: { columnVisibility, sorting },
  });

  return (
    <TanstackDataTable
      aria-label={`Tabla desplazable: ${label}`}
      className={className}
      scrollable={scrollable}
      showPagination={false}
      table={table}
      {...props}
    >
      {toolbar || showViewOptions ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          {showViewOptions ? <DataTableViewOptions table={table} /> : null}
        </div>
      ) : null}
    </TanstackDataTable>
  );
}
