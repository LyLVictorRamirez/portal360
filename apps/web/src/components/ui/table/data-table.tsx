import { type Table as TanstackTable, flexRender } from "@tanstack/react-table";
import type * as React from "react";

import { DataTablePagination } from "@/components/ui/table/data-table-pagination";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCommonPinningStyles } from "@/lib/data-table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DataTableProps<TData> extends React.ComponentProps<"div"> {
  actionBar?: React.ReactNode;
  emptyMessage?: string;
  getRowGroupKey?: (row: TData) => string | null;
  getRowSubgroupKey?: (row: TData) => string | null;
  renderRowGroupHeader?: (row: TData) => React.ReactNode;
  renderRowSubgroupHeader?: (row: TData) => React.ReactNode;
  scrollable?: boolean;
  showPagination?: boolean;
  table: TanstackTable<TData>;
}

type PortalColumnMeta = {
  align?: "center" | "left" | "right";
  cellClassName?: string;
  headerClassName?: string;
};

const alignmentClassNames: Record<NonNullable<PortalColumnMeta["align"]>, string> = {
  center: "text-center",
  left: "text-left",
  right: "text-right",
};

function getAlignmentClassName(meta: unknown) {
  const align = (meta as PortalColumnMeta | undefined)?.align;
  return align ? alignmentClassNames[align] : undefined;
}

function getCellClassName(meta: unknown) {
  return (meta as PortalColumnMeta | undefined)?.cellClassName;
}

function getHeaderClassName(meta: unknown) {
  return (meta as PortalColumnMeta | undefined)?.headerClassName;
}

export function DataTable<TData>({
  actionBar,
  children,
  className,
  emptyMessage = "No hay resultados.",
  getRowGroupKey,
  getRowSubgroupKey,
  renderRowGroupHeader,
  renderRowSubgroupHeader,
  scrollable = false,
  showPagination = true,
  table,
  ...props
}: DataTableProps<TData>) {
  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const rows = table.getRowModel().rows;
  const renderedRows: React.ReactNode[] = [];
  let previousGroupKey: string | null = null;
  let previousSubgroupKey: string | null = null;

  for (const row of rows) {
    const groupKey = getRowGroupKey?.(row.original) ?? null;
    if (groupKey && groupKey !== previousGroupKey && renderRowGroupHeader) {
      renderedRows.push(
        <TableRow className="bg-info-surface hover:bg-info-surface" key={`group-${groupKey}`}>
          <TableCell className="border-y border-info/20 px-3 py-2.5" colSpan={visibleColumnCount}>
            {renderRowGroupHeader(row.original)}
          </TableCell>
        </TableRow>,
      );
      previousSubgroupKey = null;
    }
    const subgroupKey = getRowSubgroupKey?.(row.original) ?? null;
    if (subgroupKey && subgroupKey !== previousSubgroupKey && renderRowSubgroupHeader) {
      renderedRows.push(
        <TableRow
          className="bg-info-surface/60 hover:bg-info-surface/60"
          key={`subgroup-${groupKey ?? "none"}-${subgroupKey}`}
        >
          <TableCell className="border-b border-info/15 px-3 py-1.5" colSpan={visibleColumnCount}>
            {renderRowSubgroupHeader(row.original)}
          </TableCell>
        </TableRow>,
      );
    }
    renderedRows.push(
      <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
        {row.getVisibleCells().map((cell) => (
          <TableCell
            className={cn(
              getAlignmentClassName(cell.column.columnDef.meta),
              getCellClassName(cell.column.columnDef.meta),
            )}
            key={cell.id}
            style={{
              ...getCommonPinningStyles({ column: cell.column }),
            }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>,
    );
    previousGroupKey = groupKey;
    previousSubgroupKey = subgroupKey;
  }

  return (
    <div className={cn("flex w-full flex-col space-y-4", className)} {...props}>
      {children}
      <div
        className={cn("relative w-full overflow-hidden rounded-lg border", {
          "min-h-0 flex-1": scrollable,
        })}
      >
        <ScrollArea className={cn("w-full", { "h-full": scrollable })}>
          <Table className="min-w-max">
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      className={cn(
                        getAlignmentClassName(header.column.columnDef.meta),
                        getHeaderClassName(header.column.columnDef.meta),
                      )}
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        ...getCommonPinningStyles({ column: header.column }),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                renderedRows
              ) : (
                <TableRow>
                  <TableCell colSpan={visibleColumnCount} className="h-24 text-center">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
      {showPagination || (actionBar && table.getFilteredSelectedRowModel().rows.length > 0) ? (
        <div className="flex flex-col gap-2.5">
          {showPagination ? <DataTablePagination table={table} /> : null}
          {actionBar && table.getFilteredSelectedRowModel().rows.length > 0 ? actionBar : null}
        </div>
      ) : null}
    </div>
  );
}
