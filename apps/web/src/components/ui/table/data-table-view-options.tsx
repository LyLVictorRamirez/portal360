"use client";

import type { Table } from "@tanstack/react-table";
import { Icons } from "@/components/icons";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import * as React from "react";
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

export type ColumnVisibilityOption = Readonly<{
  id: string;
  label: string;
  visible: boolean;
}>;

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => column.getCanHide()),
    [table],
  );

  return (
    <ColumnVisibilityOptions
      columns={columns.map((column) => ({
        id: column.id,
        label: column.columnDef.meta?.label ?? column.id,
        visible: column.getIsVisible(),
      }))}
      onToggle={(columnId) => {
        const column = table.getColumn(columnId);
        if (column) column.toggleVisibility(!column.getIsVisible());
      }}
    />
  );
}

export function ColumnVisibilityOptions({
  columns,
  onToggle,
}: Readonly<{
  columns: readonly ColumnVisibilityOption[];
  onToggle: (columnId: string) => void;
}>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Configurar columnas visibles"
          variant="outline"
          size="sm"
          className="h-8"
        >
          <Icons.columns />
          Ver
          <CaretSortIcon className="ml-auto opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <Command>
          <CommandInput placeholder="Buscar columnas..." />
          <CommandList>
            <CommandEmpty>No se encontraron columnas.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem key={column.id} onSelect={() => onToggle(column.id)}>
                  <span className="truncate">{column.label}</span>
                  <CheckIcon
                    className={cn(
                      "ml-auto size-4 shrink-0",
                      column.visible ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
