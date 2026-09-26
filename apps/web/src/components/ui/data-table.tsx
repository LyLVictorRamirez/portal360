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
  cellClassName?: string;
  header: string;
  headerClassName?: string;
  hideable?: boolean;
  id: string;
  maxSize?: number;
  minSize?: number;
  size?: number;
  sortValue?: (row: Row) => string | number;
};

type DataTableProps<Row extends { id: string }> = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children" | "role" | "tabIndex"
> & {
  columnVisibility?: VisibilityState;
  columns: readonly DataTableColumn<Row>[];
  label: string;
  rows: readonly Row[];
  groupBy?: (row: Row) => string | null;
  renderGroupHeader?: (row: Row) => ReactNode;
  subgroupBy?: (row: Row) => string | null;
  renderSubgroupHeader?: (row: Row) => ReactNode;
  paginate?: boolean;
  scrollable?: boolean;
  showViewOptions?: boolean;
  toolbar?: ReactNode;
  onColumnVisibilityChange?: (next: VisibilityState) => void;
};

/**
 * Compatibility boundary for Portal 360 lists. Its callers retain their domain-oriented column
 * declarations while rendering through the starter's TanStack Table implementation.
 */
export function DataTable<Row extends { id: string }>({
  className,
  columnVisibility: controlledColumnVisibility,
  columns,
  groupBy,
  label,
  renderGroupHeader,
  renderSubgroupHeader,
  rows,
  scrollable = false,
  showViewOptions = false,
  subgroupBy,
  toolbar,
  onColumnVisibilityChange,
  paginate = true,
  ...props
}: DataTableProps<Row>) {
  const data = useMemo(() => [...rows], [rows]);
  const [uncontrolledColumnVisibility, setUncontrolledColumnVisibility] = useState<VisibilityState>(
    {},
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const columnVisibility = controlledColumnVisibility ?? uncontrolledColumnVisibility;
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
        maxSize: column.maxSize,
        minSize: column.minSize,
        size: column.size,
        meta: {
          align: column.align,
          cellClassName: column.cellClassName,
          headerClassName: column.headerClassName,
          label: column.header,
        },
      })),
    [columns],
  );
  const table = useReactTable({
    columns: tableColumns,
    data,
    getSortedRowModel: getSortedRowModel(),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: paginate ? getPaginationRowModel() : undefined,
    getRowId: (row) => row.id,
    onColumnVisibilityChange: (next) => {
      const nextColumnVisibility = typeof next === "function" ? next(columnVisibility) : next;
      if (onColumnVisibilityChange) onColumnVisibilityChange(nextColumnVisibility);
      else setUncontrolledColumnVisibility(nextColumnVisibility);
    },
    onSortingChange: setSorting,
    state: { columnVisibility, sorting },
  });

  return (
    <TanstackDataTable
      aria-label={`Tabla desplazable: ${label}`}
      className={className}
      getRowGroupKey={groupBy ? (row) => groupBy(row) : undefined}
      getRowSubgroupKey={subgroupBy ? (row) => subgroupBy(row) : undefined}
      renderRowGroupHeader={renderGroupHeader}
      renderRowSubgroupHeader={renderSubgroupHeader}
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
