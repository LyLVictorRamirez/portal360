"use client";

import { useEffect, useMemo, useState } from "react";

import { TicketDeleteDialog } from "./ticket-delete-dialog";
import { TicketEditorDialog, type TicketEditorMode } from "./ticket-editor-dialog";
import { Icons } from "../../../components/icons";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { Button } from "../../../components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../../../components/ui/command";
import { DataTable, type DataTableColumn } from "../../../components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Input } from "../../../components/ui/input";
import { PageHeader } from "../../../components/ui/page-header";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import { listClients, type Client } from "../../../lib/clients-client";
import {
  listTickets,
  type Ticket,
  type TicketExternalPriority,
  type TicketExternalPriorityFilter,
  type TicketList,
} from "../../../lib/tickets-client";

type TicketListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; list: TicketList }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type TicketEditorState = Readonly<{ mode: TicketEditorMode; ticket: Ticket | null }>;
type TicketManagementProps = Readonly<{ canManageTickets: boolean }>;
type ClientOptionsState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ clients: readonly Client[]; kind: "ready"; total: number }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

const priorityLabels: Record<TicketExternalPriorityFilter, string> = {
  all: "Todas",
  critical: "Crítica",
  high: "Alta",
  low: "Baja",
  medium: "Media",
};

const priorityTones: Record<TicketExternalPriority, StatusBadgeTone> = {
  critical: "danger",
  high: "warning",
  low: "success",
  medium: "planned",
};

export function TicketManagement({ canManageTickets }: TicketManagementProps) {
  const [clientFilterId, setClientFilterId] = useState("all");
  const [clientOptionsState, setClientOptionsState] = useState<ClientOptionsState>({
    kind: "loading",
  });
  const [clientSearch, setClientSearch] = useState("");
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editor, setEditor] = useState<TicketEditorState | null>(null);
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState<TicketExternalPriorityFilter>("all");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<TicketListState>({ kind: "loading" });
  const [ticketToDelete, setTicketToDelete] = useState<Ticket | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await listClients({ query: clientSearch, status: "all" });

      if (!current) {
        return;
      }

      setClientOptionsState(
        result.kind === "success"
          ? { clients: result.data.clients, kind: "ready", total: result.data.total }
          : result.kind === "unauthorized"
            ? result
            : { kind: "error", message: result.message },
      );
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [clientSearch]);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await listTickets({
        clientId: clientFilterId === "all" ? undefined : clientFilterId,
        page,
        priority,
        query,
      });
      if (!current) return;
      setState(
        result.kind === "success"
          ? { kind: "ready", list: result.data }
          : result.kind === "unauthorized"
            ? result
            : { kind: "error", message: result.message },
      );
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [clientFilterId, page, priority, query, reloadKey]);

  const list = state.kind === "ready" ? state.list : null;
  const clientOptions = clientOptionsState.kind === "ready" ? clientOptionsState.clients : [];
  const visibleClientOptions =
    selectedClient && !clientOptions.some((client) => client.id === selectedClient.id)
      ? [selectedClient, ...clientOptions]
      : clientOptions;
  const totalPages = useMemo(
    () => (list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1),
    [list],
  );
  const hasFilters = Boolean(query.trim()) || priority !== "all" || clientFilterId !== "all";
  const refresh = (message: string) => {
    setUpdateMessage(message);
    setReloadKey((value) => value + 1);
  };
  const updateFilters = (
    nextQuery: string,
    nextPriority: TicketExternalPriorityFilter,
    nextClient: string,
  ) => {
    setPage(1);
    setQuery(nextQuery);
    setPriority(nextPriority);
    setClientFilterId(nextClient);
    setUpdateMessage(null);
  };
  const columns = createColumns(
    canManageTickets,
    (ticket) => setEditor({ mode: "view", ticket }),
    (ticket) => setEditor({ mode: "edit", ticket }),
    setTicketToDelete,
  );
  const filters = (
    <div
      aria-label="Buscar y filtrar Tickets"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="ticket-search">
        Buscar Tickets
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="ticket-search"
        onChange={(event) => updateFilters(event.target.value, priority, clientFilterId)}
        placeholder="Buscar Tickets..."
        type="search"
        value={query}
      />
      <Popover onOpenChange={setIsClientFilterOpen} open={isClientFilterOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Cliente
            {selectedClient ? (
              <span className="max-w-40 truncate text-primary">{selectedClient.name}</span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={(value) => {
                setClientSearch(value);
                setClientOptionsState({ kind: "loading" });
              }}
              placeholder="Buscar Clientes..."
              value={clientSearch}
            />
            <CommandList>
              <CommandEmpty>No se encontraron Clientes.</CommandEmpty>
              <CommandItem
                onSelect={() => {
                  setSelectedClient(null);
                  updateFilters(query, priority, "all");
                  setIsClientFilterOpen(false);
                }}
                value="Todos los Clientes"
              >
                <Icons.check
                  className={clientFilterId === "all" ? "size-4 text-primary" : "size-4 opacity-0"}
                />
                Todos los Clientes
              </CommandItem>
              {visibleClientOptions.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => {
                    setSelectedClient(client);
                    updateFilters(query, priority, client.id);
                    setIsClientFilterOpen(false);
                  }}
                  value={`${client.code} ${client.name}`}
                >
                  <Icons.check
                    className={
                      clientFilterId === client.id ? "size-4 text-primary" : "size-4 opacity-0"
                    }
                  />
                  {client.code} — {client.name}
                </CommandItem>
              ))}
              {clientOptionsState.kind === "loading" ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">Buscando Clientes...</p>
              ) : null}
              {clientOptionsState.kind === "error" ? (
                <p className="px-2 py-2 text-xs text-danger" role="alert">
                  No fue posible buscar Clientes: {clientOptionsState.message}
                </p>
              ) : null}
              {clientOptionsState.kind === "unauthorized" ? (
                <p className="px-2 py-2 text-xs text-danger" role="alert">
                  Tu sesión no permite consultar Clientes.
                </p>
              ) : null}
              {clientOptionsState.kind === "ready" &&
              clientOptionsState.total > clientOptions.length ? (
                <p className="px-2 py-2 text-xs text-muted-foreground">
                  Busca por nombre o código para ver más Clientes.
                </p>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Prioridad
            {priority !== "all" ? (
              <span className="text-primary">{priorityLabels[priority]}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filtrar por prioridad</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(nextPriority) =>
              updateFilters(query, nextPriority as TicketExternalPriorityFilter, clientFilterId)
            }
            value={priority}
          >
            {(Object.keys(priorityLabels) as TicketExternalPriorityFilter[]).map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {priorityLabels[value]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {hasFilters ? (
        <Button
          onClick={() => {
            setSelectedClient(null);
            setClientSearch("");
            updateFilters("", "all", "all");
          }}
          size="sm"
          variant="ghost"
        >
          <Icons.close />
          Restablecer
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 w-full flex-col">
      <div className="shrink-0 space-y-4 pb-4">
        <PageHeader
          actions={
            canManageTickets ? (
              <Button onClick={() => setEditor({ mode: "create", ticket: null })}>
                Crear Ticket
              </Button>
            ) : undefined
          }
          title="Tickets"
        />
        {updateMessage ? (
          <p aria-live="polite" className="text-sm font-medium text-success">
            {updateMessage}
          </p>
        ) : null}
      </div>
      {state.kind === "loading" ? <LoadingState title="Consultando Tickets" /> : null}
      {state.kind === "unauthorized" ? (
        <UnauthorizedState description="Tu sesión ya no permite consultar Tickets." />
      ) : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar los Tickets"
        />
      ) : null}
      {list?.tickets.length === 0 ? (
        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <div>{filters}</div>
          <EmptyState
            action={
              canManageTickets && !hasFilters ? (
                <Button onClick={() => setEditor({ mode: "create", ticket: null })}>
                  Crear primer Ticket
                </Button>
              ) : undefined
            }
            description={
              hasFilters
                ? "No hay Tickets que coincidan con los filtros seleccionados."
                : "Registra un Ticket externo para un Cliente activo."
            }
            title={hasFilters ? "No encontramos Tickets" : "Aún no hay Tickets"}
          />
        </section>
      ) : null}
      {list?.tickets.length ? (
        <section
          aria-labelledby="ticket-table-title"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <h2 className="sr-only" id="ticket-table-title">
            Tickets registrados
          </h2>
          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            label="Tickets registrados"
            rows={list.tickets}
            scrollable
            showViewOptions
            toolbar={filters}
          />
          <Pagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </section>
      ) : null}
      {editor ? (
        <TicketEditorDialog
          mode={editor.mode}
          onOpenChange={(open) => !open && setEditor(null)}
          onTicketSaved={(ticket, created) =>
            refresh(created ? `Se creó ${ticket.title}.` : `Se actualizó ${ticket.title}.`)
          }
          open
          ticket={editor.ticket}
        />
      ) : null}
      {ticketToDelete ? (
        <TicketDeleteDialog
          onDeleted={() => refresh(`Se eliminó ${ticketToDelete.title}.`)}
          onOpenChange={(open) => !open && setTicketToDelete(null)}
          open
          ticket={ticketToDelete}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  onPageChange,
  page,
  pageSize,
  total,
  totalPages,
}: Readonly<{
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}>) {
  return (
    <div
      aria-label="Paginación de Tickets"
      className="shrink-0 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
      role="navigation"
    >
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "registro en total." : "registros en total."}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="text-sm font-medium text-foreground whitespace-nowrap">
          Filas por página
          <span className="ml-2 inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-normal shadow-xs">
            {pageSize}
          </span>
        </p>
        <p className="text-sm">
          Página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Ir a la primera página"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronsLeft />
          </Button>
          <Button
            aria-label="Ir a la página anterior"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronLeft />
          </Button>
          <Button
            aria-label="Ir a la página siguiente"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronRight />
          </Button>
          <Button
            aria-label="Ir a la última página"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            size="icon"
            variant="outline"
          >
            <Icons.chevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function createColumns(
  canManage: boolean,
  onView: (ticket: Ticket) => void,
  onEdit: (ticket: Ticket) => void,
  onDelete: (ticket: Ticket) => void,
): DataTableColumn<Ticket>[] {
  return [
    {
      cell: (ticket) => (
        <span className="font-semibold tabular-nums text-primary">{ticket.externalReference}</span>
      ),
      header: "Referencia",
      hideable: true,
      id: "reference",
      sortValue: (ticket) => ticket.externalReference,
    },
    {
      cell: (ticket) => <span className="font-semibold text-foreground">{ticket.title}</span>,
      header: "Ticket",
      hideable: true,
      id: "title",
      sortValue: (ticket) => ticket.title,
    },
    {
      cell: (ticket) => (
        <span className="text-sm text-foreground">
          <span className="font-medium">{ticket.client.name}</span>
          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
            {ticket.client.code}
          </span>
        </span>
      ),
      header: "Cliente",
      hideable: true,
      id: "client",
      sortValue: (ticket) => ticket.client.name,
    },
    {
      cell: (ticket) => (
        <StatusBadge
          label={priorityLabels[ticket.externalPriority]}
          tone={priorityTones[ticket.externalPriority]}
        />
      ),
      header: "Prioridad",
      hideable: true,
      id: "priority",
      sortValue: (ticket) => ticket.externalPriority,
    },
    {
      align: "right",
      cell: (ticket) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Acciones para ${ticket.title}`} size="icon" variant="ghost">
              <Icons.ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onView(ticket)}>
              <Icons.info />
              Ver detalle
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuItem onSelect={() => onEdit(ticket)}>
                  <Icons.edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(ticket)} variant="destructive">
                  <Icons.trash />
                  Eliminar
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      header: "Acciones",
      id: "actions",
    },
  ];
}
