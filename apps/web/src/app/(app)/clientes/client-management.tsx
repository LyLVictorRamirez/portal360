"use client";

import { useEffect, useMemo, useState } from "react";

import { ClientDeleteDialog } from "./client-delete-dialog";
import { ClientEditorDialog, type ClientEditorMode } from "./client-editor-dialog";
import { Icons } from "../../../components/icons";
import { Button } from "../../../components/ui/button";
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
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { Input } from "../../../components/ui/input";
import {
  listClients,
  updateClient,
  type Client,
  type ClientList,
  type ClientStatusFilter,
} from "../../../lib/clients-client";

type ClientListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; list: ClientList }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ClientEditorState = Readonly<{
  client: Client | null;
  mode: ClientEditorMode;
}>;

type ClientManagementProps = Readonly<{
  canManageClients: boolean;
}>;

const clientStatusFilterLabels: Record<ClientStatusFilter, string> = {
  active: "Activos",
  all: "Todos",
  inactive: "Inactivos",
};

export function ClientManagement({ canManageClients }: ClientManagementProps) {
  const [editor, setEditor] = useState<ClientEditorState | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ClientListState>({ kind: "loading" });
  const [status, setStatus] = useState<ClientStatusFilter>("all");
  const [actionError, setActionError] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [updatingClientId, setUpdatingClientId] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      setState({ kind: "loading" });
      const result = await listClients({ page, query, status });

      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({ kind: "ready", list: result.data });
        return;
      }

      setState(
        result.kind === "unauthorized"
          ? result
          : {
              kind: "error",
              message: result.message,
            },
      );
    }, 200);

    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [page, query, reloadKey, status]);

  function retry() {
    setReloadKey((value) => value + 1);
  }

  function refreshWithMessage(message: string) {
    setActionError(null);
    setUpdateMessage(message);
    setReloadKey((value) => value + 1);
  }

  function updateFilters(nextQuery: string, nextStatus: ClientStatusFilter) {
    setPage(1);
    setQuery(nextQuery);
    setStatus(nextStatus);
    setActionError(null);
    setUpdateMessage(null);
  }

  async function toggleClientState(client: Client) {
    setUpdatingClientId(client.id);
    setActionError(null);
    setUpdateMessage(null);
    const result = await updateClient(client.id, {
      isActive: !client.isActive,
      version: client.version,
    });
    setUpdatingClientId(null);

    if (result.kind === "success") {
      refreshWithMessage(
        result.data.isActive
          ? `Se activó ${result.data.name}.`
          : `Se desactivó ${result.data.name}.`,
      );
      return;
    }

    if (result.kind === "unauthorized") {
      setState({ kind: "unauthorized" });
      return;
    }

    setActionError(
      result.kind === "conflict"
        ? "El Cliente cambió mientras lo actualizabas. Recarga el listado antes de intentarlo de nuevo."
        : result.message,
    );
  }

  const list = state.kind === "ready" ? state.list : null;
  const totalPages = useMemo(
    () => (list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1),
    [list],
  );
  const columns = createColumns(
    canManageClients,
    updatingClientId,
    (client) => setEditor({ client, mode: "view" }),
    (client) => setEditor({ client, mode: "edit" }),
    (client) => void toggleClientState(client),
    (client) => setClientToDelete(client),
  );
  const clientFilters = (
    <div
      aria-label="Buscar y filtrar Clientes"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="client-search">
        Buscar Clientes
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="client-search"
        onChange={(event) => updateFilters(event.target.value, status)}
        placeholder="Buscar Clientes..."
        type="search"
        value={query}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Estado
            {status !== "all" ? (
              <span className="text-primary">{clientStatusFilterLabels[status]}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(nextStatus) => updateFilters(query, nextStatus as ClientStatusFilter)}
            value={status}
          >
            {(Object.keys(clientStatusFilterLabels) as ClientStatusFilter[]).map(
              (filterStatus) => (
                <DropdownMenuRadioItem key={filterStatus} value={filterStatus}>
                  {clientStatusFilterLabels[filterStatus]}
                </DropdownMenuRadioItem>
              ),
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {query.trim() || status !== "all" ? (
        <Button onClick={() => updateFilters("", "all")} size="sm" variant="ghost">
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
            canManageClients ? (
              <Button
                onClick={() => {
                  setEditor({ client: null, mode: "create" });
                  setActionError(null);
                  setUpdateMessage(null);
                }}
              >
                Crear Cliente
              </Button>
            ) : undefined
          }
          title="Clientes"
        />
        {updateMessage ? (
          <p aria-live="polite" className="max-w-md text-sm font-medium text-success">
            {updateMessage}
          </p>
        ) : null}
        {actionError ? (
          <p aria-live="assertive" className="max-w-md text-sm font-medium text-danger">
            {actionError}
          </p>
        ) : null}
      </div>

      {state.kind === "loading" ? <LoadingState title="Consultando Clientes" /> : null}
      {state.kind === "unauthorized" ? (
        <UnauthorizedState description="Tu sesión ya no permite consultar Clientes." />
      ) : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={retry}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar los Clientes"
        />
      ) : null}
      {list && list.clients.length === 0 ? (
        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0">{clientFilters}</div>
          <EmptyState
            action={
              canManageClients && !query.trim() && status === "all" ? (
                <Button
                  onClick={() => {
                    setEditor({ client: null, mode: "create" });
                    setActionError(null);
                    setUpdateMessage(null);
                  }}
                >
                  Crear primer Cliente
                </Button>
              ) : undefined
            }
            description={
              query.trim() || status !== "all"
                ? "No hay Clientes que coincidan con los filtros seleccionados."
                : "Crea el primer Cliente para empezar a relacionar el trabajo de Portal 360."
            }
            title={
              query.trim() || status !== "all" ? "No encontramos Clientes" : "Aún no hay Clientes"
            }
          />
        </section>
      ) : null}
      {list && list.clients.length > 0 ? (
        <section
          aria-labelledby="client-table-title"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <h2 className="sr-only" id="client-table-title">
            Clientes registrados
          </h2>
          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            label="Clientes registrados"
            rows={list.clients}
            scrollable
            showViewOptions
            toolbar={
              <div
                aria-label="Buscar y filtrar Clientes"
                className="flex flex-wrap items-center gap-2"
                role="search"
              >
                <label className="sr-only" htmlFor="client-search">
                  Buscar Clientes
                </label>
                <Input
                  autoComplete="off"
                  className="w-full sm:w-72"
                  id="client-search"
                  onChange={(event) => updateFilters(event.target.value, status)}
                  placeholder="Buscar Clientes..."
                  type="search"
                  value={query}
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Icons.adjustments />
                      Estado
                      {status !== "all" ? (
                        <span className="text-primary">{clientStatusFilterLabels[status]}</span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      onValueChange={(nextStatus) =>
                        updateFilters(query, nextStatus as ClientStatusFilter)
                      }
                      value={status}
                    >
                      {(Object.keys(clientStatusFilterLabels) as ClientStatusFilter[]).map(
                        (filterStatus) => (
                          <DropdownMenuRadioItem key={filterStatus} value={filterStatus}>
                            {clientStatusFilterLabels[filterStatus]}
                          </DropdownMenuRadioItem>
                        ),
                      )}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {query.trim() || status !== "all" ? (
                  <Button onClick={() => updateFilters("", "all")} size="sm" variant="ghost">
                    <Icons.close />
                    Restablecer
                  </Button>
                ) : null}
              </div>
            }
          />
          <div
            aria-label="Paginación de Clientes"
            className="shrink-0 flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between"
            role="navigation"
          >
            <p className="text-sm text-muted-foreground">
              {list.total} {list.total === 1 ? "registro en total." : "registros en total."}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                Filas por página
                <span className="ml-2 inline-flex h-8 min-w-12 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-normal shadow-xs">
                  {list.pageSize}
                </span>
              </p>
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                Página {list.page} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  aria-label="Ir a la primera página"
                  disabled={list.page <= 1}
                  onClick={() => setPage(1)}
                  size="icon"
                  variant="outline"
                >
                  <Icons.chevronsLeft />
                </Button>
                <Button
                  aria-label="Ir a la página anterior"
                  disabled={list.page <= 1}
                  onClick={() => setPage(list.page - 1)}
                  size="icon"
                  variant="outline"
                >
                  <Icons.chevronLeft />
                </Button>
                <Button
                  aria-label="Ir a la página siguiente"
                  disabled={list.page >= totalPages}
                  onClick={() => setPage(list.page + 1)}
                  size="icon"
                  variant="outline"
                >
                  <Icons.chevronRight />
                </Button>
                <Button
                  aria-label="Ir a la última página"
                  disabled={list.page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  size="icon"
                  variant="outline"
                >
                  <Icons.chevronsRight />
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {editor ? (
        <ClientEditorDialog
          client={editor.client}
          mode={editor.mode}
          onClientSaved={(client, created) => {
            refreshWithMessage(
              created ? `Se creó ${client.name}.` : `Se actualizó ${client.name}.`,
            );
          }}
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
            }
          }}
          open={editor !== null}
        />
      ) : null}
      {clientToDelete ? (
        <ClientDeleteDialog
          client={clientToDelete}
          onDeleted={(client) => refreshWithMessage(`Se eliminó ${client.name}.`)}
          onOpenChange={(open) => {
            if (!open) {
              setClientToDelete(null);
            }
          }}
          open={clientToDelete !== null}
        />
      ) : null}
    </div>
  );
}

function createColumns(
  canManageClients: boolean,
  updatingClientId: string | null,
  onView: (client: Client) => void,
  onEdit: (client: Client) => void,
  onToggleState: (client: Client) => void,
  onDelete: (client: Client) => void,
): DataTableColumn<Client>[] {
  return [
    {
      cell: (client) => (
        <span className="font-semibold tabular-nums text-primary">{client.code}</span>
      ),
      header: "Código",
      hideable: true,
      id: "code",
      sortValue: (client) => client.code,
    },
    {
      cell: (client) => <span className="font-semibold text-foreground">{client.name}</span>,
      header: "Cliente",
      hideable: true,
      id: "name",
      sortValue: (client) => client.name,
    },
    {
      cell: (client) => (
        <StatusBadge
          label={client.isActive ? "Activo" : "Inactivo"}
          tone={client.isActive ? "success" : "inactive"}
        />
      ),
      header: "Estado",
      hideable: true,
      id: "status",
      sortValue: (client) => (client.isActive ? "Activo" : "Inactivo"),
    },
    {
      align: "right",
      cell: (client) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Acciones para ${client.name}`} size="icon" variant="ghost">
              <Icons.ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onView(client)}>
              <Icons.info />
              Ver detalle
            </DropdownMenuItem>
            {canManageClients ? (
              <>
                <DropdownMenuItem onSelect={() => onEdit(client)}>
                  <Icons.edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={updatingClientId === client.id}
                  onSelect={() => onToggleState(client)}
                >
                  {client.isActive ? <Icons.slash /> : <Icons.circleCheck />}
                  {updatingClientId === client.id
                    ? "Actualizando…"
                    : client.isActive
                      ? "Desactivar"
                      : "Activar"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(client)} variant="destructive">
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
