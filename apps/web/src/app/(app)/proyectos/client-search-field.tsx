"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "../../../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { Label } from "../../../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { listClients, type Client } from "../../../lib/clients-client";

type ClientSearchState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ clients: readonly Client[]; kind: "ready"; total: number }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ClientSearchFieldProps = Readonly<{
  disabled: boolean;
  onSelectedClientChange: (client: Client | null) => void;
  selectedClient: Client | null;
}>;

export function ClientSearchField({
  disabled,
  onSelectedClientChange,
  selectedClient,
}: ClientSearchFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ClientSearchState>({ kind: "loading" });
  const triggerId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await listClients({ query, status: "active" });

      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({
          clients: result.data.clients,
          kind: "ready",
          total: result.data.total,
        });
        return;
      }

      setState(
        result.kind === "unauthorized" ? result : { kind: "error", message: result.message },
      );
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [isOpen, query]);

  function selectClient(client: Client) {
    onSelectedClientChange(client);
    setQuery("");
    setState({ kind: "loading" });
    setIsOpen(false);
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={triggerId}>Cliente</Label>
      <Popover onOpenChange={setIsOpen} open={isOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            className="h-10 w-full justify-between border-border bg-surface px-3 text-left font-normal hover:bg-surface-muted"
            disabled={disabled}
            id={triggerId}
            role="combobox"
            variant="outline"
          >
            <span className={selectedClient ? "truncate" : "truncate text-muted"}>
              {selectedClient
                ? `${selectedClient.code} · ${selectedClient.name}`
                : "Selecciona un Cliente"}
            </span>
            <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) gap-0 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              aria-label="Buscar Cliente"
              onValueChange={(value) => {
                setQuery(value);
                setState({ kind: "loading" });
              }}
              placeholder="Buscar Cliente…"
              value={query}
            />
            <CommandList>
              {state.kind === "loading" ? (
                <p aria-live="polite" className="px-3 py-2 text-sm leading-6 text-muted">
                  Buscando Clientes…
                </p>
              ) : null}
              {state.kind === "unauthorized" ? (
                <p className="px-3 py-2 text-sm leading-6 text-danger" role="alert">
                  Tu sesión no permite consultar los Clientes.
                </p>
              ) : null}
              {state.kind === "error" ? (
                <p className="px-3 py-2 text-sm leading-6 text-danger" role="alert">
                  No fue posible buscar Clientes: {state.message}
                </p>
              ) : null}
              {state.kind === "ready" && state.clients.length === 0 ? (
                <CommandEmpty>No hay Clientes activos que coincidan con la búsqueda.</CommandEmpty>
              ) : null}
              {state.kind === "ready" && state.clients.length > 0 ? (
                <CommandGroup aria-label="Opciones de Clientes">
                  {state.clients.map((client) => (
                    <CommandItem
                      data-checked={client.id === selectedClient?.id || undefined}
                      key={client.id}
                      onSelect={() => selectClient(client)}
                      value={client.id}
                    >
                      <span className="min-w-0 truncate">{client.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-xs text-muted">
                        {client.code}
                      </span>
                      {client.id === selectedClient?.id ? <Check aria-hidden="true" /> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {state.kind === "ready" && state.total > state.clients.length ? (
                <p className="border-t border-border px-3 py-2 text-xs leading-5 text-muted">
                  Escribe una búsqueda más específica para encontrar otro Cliente.
                </p>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
