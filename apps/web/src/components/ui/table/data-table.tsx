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
  scrollable?: boolean;
  showPagination?: boolean;
  table: TanstackTable<TData>;
}

type PortalColumnMeta = {
  align?: "center" | "left" | "right";
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

export function DataTable<TData>({
  actionBar,
  children,
  className,
  emptyMessage = "No hay resultados.",
  scrollable = false,
  showPagination = true,
  table,
  ...props
}: DataTableProps<TData>) {
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
                      className={getAlignmentClassName(header.column.columnDef.meta)}
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
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        className={getAlignmentClassName(cell.column.columnDef.meta)}
                        key={cell.id}
                        style={{
                          ...getCommonPinningStyles({ column: cell.column }),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
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
