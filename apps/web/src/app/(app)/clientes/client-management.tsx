"use client";

import { useEffect, useMemo, useState } from "react";

import { ClientDeleteDialog } from "./client-delete-dialog";
import { ClientEditorDialog, type ClientEditorMode } from "./client-editor-dialog";
import { Button } from "../../../components/ui/button";
import { DataTable, type DataTableColumn } from "../../../components/ui/data-table";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { PageHeader } from "../../../components/ui/page-header";
import { SelectField } from "../../../components/ui/select-field";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TextField } from "../../../components/ui/text-field";
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
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
        description="Mantén el catálogo de Clientes que organiza el trabajo posterior de proyectos, requerimientos y tickets."
        title="Clientes"
      />

      <section aria-labelledby="client-search-title" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="client-search-title"
            >
              Catálogo de Clientes
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Busca por código o nombre, y conserva visibles los Clientes inactivos cuando lo
              necesites.
            </p>
          </div>
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

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <TextField
            autoComplete="off"
            label="Buscar Clientes"
            onChange={(event) => updateFilters(event.target.value, status)}
            placeholder="Código o nombre"
            type="search"
            value={query}
          />
          <SelectField
            label="Estado"
            onChange={(event) => updateFilters(query, event.target.value as ClientStatusFilter)}
            value={status}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </SelectField>
        </div>
      </section>

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
      ) : null}
      {list && list.clients.length > 0 ? (
        <section aria-labelledby="client-table-title" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground" id="client-table-title">
              {list.total} {list.total === 1 ? "Cliente" : "Clientes"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Página {list.page} de {totalPages}
            </p>
          </div>
          <DataTable columns={columns} label="Clientes registrados" rows={list.clients} />
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button
              disabled={list.page <= 1}
              onClick={() => setPage(list.page - 1)}
              variant="secondary"
            >
              Anterior
            </Button>
            <Button
              disabled={list.page >= totalPages}
              onClick={() => setPage(list.page + 1)}
              variant="secondary"
            >
              Siguiente
            </Button>
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
      id: "code",
    },
    {
      cell: (client) => <span className="font-semibold text-foreground">{client.name}</span>,
      header: "Cliente",
      id: "name",
    },
    {
      cell: (client) => (
        <StatusBadge
          label={client.isActive ? "Activo" : "Inactivo"}
          tone={client.isActive ? "success" : "inactive"}
        />
      ),
      header: "Estado",
      id: "status",
    },
    {
      align: "right",
      cell: (client) => (
        <div className="flex min-w-[17rem] flex-wrap justify-end gap-2">
          <Button onClick={() => onView(client)} size="sm" variant="ghost">
            Ver detalle
          </Button>
          {canManageClients ? (
            <>
              <Button onClick={() => onEdit(client)} size="sm" variant="secondary">
                Editar
              </Button>
              <Button
                disabled={updatingClientId === client.id}
                onClick={() => onToggleState(client)}
                size="sm"
                variant="ghost"
              >
                {updatingClientId === client.id
                  ? "Actualizando…"
                  : client.isActive
                    ? "Desactivar"
                    : "Activar"}
              </Button>
              <Button onClick={() => onDelete(client)} size="sm" variant="ghost">
                Eliminar
              </Button>
            </>
          ) : null}
        </div>
      ),
      header: "Acciones",
      id: "actions",
    },
  ];
}
