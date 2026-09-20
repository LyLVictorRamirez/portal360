"use client";

import { useEffect, useMemo, useState } from "react";

import { RequirementDeleteDialog } from "./requirement-delete-dialog";
import { RequirementEditorDialog, type RequirementEditorMode } from "./requirement-editor-dialog";
import { Button } from "../../../components/ui/button";
import { DataTable, type DataTableColumn } from "../../../components/ui/data-table";
import { PageHeader } from "../../../components/ui/page-header";
import { SelectField } from "../../../components/ui/select-field";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { TextField } from "../../../components/ui/text-field";
import { listClients, type Client } from "../../../lib/clients-client";
import {
  listRequirements,
  type Requirement,
  type RequirementList,
  type RequirementStatus,
  type RequirementStatusFilter,
} from "../../../lib/requirements-client";

type RequirementListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; list: RequirementList }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ClientOptionsState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ clients: readonly Client[]; kind: "ready" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type RequirementEditorState = Readonly<{
  mode: RequirementEditorMode;
  requirement: Requirement | null;
}>;

type RequirementManagementProps = Readonly<{
  canManageRequirements: boolean;
}>;

const requirementStatusLabels: Record<RequirementStatus, string> = {
  approved: "Aprobado",
  cancelled: "Cancelado",
  closed: "Cerrado",
  in_analysis: "En análisis",
  in_execution: "En ejecución",
  new: "Nuevo",
  quoted: "Cotizado",
};

const requirementStatusTones: Record<RequirementStatus, StatusBadgeTone> = {
  approved: "success",
  cancelled: "danger",
  closed: "neutral",
  in_analysis: "warning",
  in_execution: "info",
  new: "neutral",
  quoted: "info",
};

export function RequirementManagement({ canManageRequirements }: RequirementManagementProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientFilterId, setClientFilterId] = useState("all");
  const [clientOptionsState, setClientOptionsState] = useState<ClientOptionsState>({
    kind: "loading",
  });
  const [editor, setEditor] = useState<RequirementEditorState | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [requirementToDelete, setRequirementToDelete] = useState<Requirement | null>(null);
  const [state, setState] = useState<RequirementListState>({ kind: "loading" });
  const [status, setStatus] = useState<RequirementStatusFilter>("all");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;

    void listClients({ status: "all" }).then((result) => {
      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setClientOptionsState({ clients: result.data.clients, kind: "ready" });
        return;
      }

      setClientOptionsState(
        result.kind === "unauthorized" ? result : { kind: "error", message: result.message },
      );
    });

    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      setState({ kind: "loading" });
      const result = await listRequirements({
        clientId: clientFilterId === "all" ? undefined : clientFilterId,
        page,
        query,
        status,
      });

      if (!current) {
        return;
      }

      if (result.kind === "success") {
        setState({ kind: "ready", list: result.data });
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
  }, [clientFilterId, page, query, reloadKey, status]);

  function retry() {
    setReloadKey((value) => value + 1);
  }

  function refreshWithMessage(message: string) {
    setActionError(null);
    setUpdateMessage(message);
    setReloadKey((value) => value + 1);
  }

  function updateFilters(
    nextQuery: string,
    nextStatus: RequirementStatusFilter,
    nextClientFilterId: string,
  ) {
    setActionError(null);
    setClientFilterId(nextClientFilterId);
    setPage(1);
    setQuery(nextQuery);
    setStatus(nextStatus);
    setUpdateMessage(null);
  }

  const clientOptions = clientOptionsState.kind === "ready" ? clientOptionsState.clients : [];
  const list = state.kind === "ready" ? state.list : null;
  const totalPages = useMemo(
    () => (list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1),
    [list],
  );
  const columns = createColumns(
    canManageRequirements,
    (requirement) => setEditor({ mode: "view", requirement }),
    (requirement) => setEditor({ mode: "edit", requirement }),
    (requirement) => setRequirementToDelete(requirement),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        actions={
          canManageRequirements ? (
            <Button
              onClick={() => {
                setActionError(null);
                setEditor({ mode: "create", requirement: null });
                setUpdateMessage(null);
              }}
            >
              Crear Requerimiento
            </Button>
          ) : undefined
        }
        description="Registra la solicitud de cada Cliente y acompaña su análisis, cotización, aprobación y ejecución con un código operativo."
        title="Requerimientos"
      />

      <section aria-labelledby="requirement-search-title" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="requirement-search-title"
            >
              Solicitudes registradas
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              Filtra por Cliente y estado, o busca por código y nombre para seguir cada solicitud.
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

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem_12rem]">
          <TextField
            autoComplete="off"
            label="Buscar Requerimientos"
            onChange={(event) => updateFilters(event.target.value, status, clientFilterId)}
            placeholder="Código o nombre"
            type="search"
            value={query}
          />
          <SelectField
            label="Cliente"
            onChange={(event) => updateFilters(query, status, event.target.value)}
            value={clientFilterId}
          >
            <option value="all">Todos los Clientes</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.code} — {client.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Estado"
            onChange={(event) =>
              updateFilters(query, event.target.value as RequirementStatusFilter, clientFilterId)
            }
            value={status}
          >
            <option value="all">Todos</option>
            {Object.entries(requirementStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
      </section>

      {clientOptionsState.kind === "error" ? (
        <p role="alert" className="text-sm leading-6 text-danger">
          No fue posible cargar los Clientes para los filtros: {clientOptionsState.message}
        </p>
      ) : null}
      {clientOptionsState.kind === "unauthorized" ? (
        <p role="alert" className="text-sm leading-6 text-danger">
          Tu sesión ya no permite consultar los Clientes necesarios para crear un Requerimiento.
        </p>
      ) : null}
      {state.kind === "loading" ? <LoadingState title="Consultando Requerimientos" /> : null}
      {state.kind === "unauthorized" ? (
        <UnauthorizedState description="Tu sesión ya no permite consultar Requerimientos." />
      ) : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={retry}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar los Requerimientos"
        />
      ) : null}
      {list && list.requirements.length === 0 ? (
        <EmptyState
          action={
            canManageRequirements &&
            !query.trim() &&
            status === "all" &&
            clientFilterId === "all" ? (
              <Button
                onClick={() => {
                  setActionError(null);
                  setEditor({ mode: "create", requirement: null });
                  setUpdateMessage(null);
                }}
              >
                Crear primer Requerimiento
              </Button>
            ) : undefined
          }
          description={
            query.trim() || status !== "all" || clientFilterId !== "all"
              ? "No hay Requerimientos que coincidan con los filtros seleccionados."
              : "Crea el primer Requerimiento para registrar una solicitud de un Cliente activo."
          }
          title={
            query.trim() || status !== "all" || clientFilterId !== "all"
              ? "No encontramos Requerimientos"
              : "Aún no hay Requerimientos"
          }
        />
      ) : null}
      {list && list.requirements.length > 0 ? (
        <section aria-labelledby="requirement-table-title" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground" id="requirement-table-title">
              {list.total} {list.total === 1 ? "Requerimiento" : "Requerimientos"}
            </h2>
            <p className="text-sm text-muted">
              Página {list.page} de {totalPages}
            </p>
          </div>
          <DataTable
            columns={columns}
            label="Requerimientos registrados"
            rows={list.requirements}
          />
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
        <RequirementEditorDialog
          mode={editor.mode}
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
            }
          }}
          onRequirementSaved={(requirement, created) => {
            refreshWithMessage(
              created ? `Se creó ${requirement.name}.` : `Se actualizó ${requirement.name}.`,
            );
          }}
          open={editor !== null}
          requirement={editor.requirement}
        />
      ) : null}
      {requirementToDelete ? (
        <RequirementDeleteDialog
          onDeleted={() => refreshWithMessage(`Se eliminó ${requirementToDelete.name}.`)}
          onOpenChange={(open) => {
            if (!open) {
              setRequirementToDelete(null);
            }
          }}
          open={requirementToDelete !== null}
          requirement={requirementToDelete}
        />
      ) : null}
    </div>
  );
}

function createColumns(
  canManageRequirements: boolean,
  onView: (requirement: Requirement) => void,
  onEdit: (requirement: Requirement) => void,
  onDelete: (requirement: Requirement) => void,
): DataTableColumn<Requirement>[] {
  return [
    {
      cell: (requirement) => (
        <span className="font-semibold tabular-nums text-primary">{requirement.code}</span>
      ),
      header: "Código",
      id: "code",
    },
    {
      cell: (requirement) => (
        <span className="font-semibold text-foreground">{requirement.name}</span>
      ),
      header: "Requerimiento",
      id: "name",
    },
    {
      cell: (requirement) => (
        <span className="text-sm text-foreground">
          <span className="font-medium">{requirement.client.name}</span>
          <span className="mt-0.5 block font-mono text-xs text-muted">
            {requirement.client.code}
          </span>
        </span>
      ),
      header: "Cliente",
      id: "client",
    },
    {
      cell: (requirement) => (
        <span className="whitespace-nowrap text-muted">
          Solicitud: {requirement.requestedOn}
          <span className="mt-0.5 block">Compromiso: {requirement.committedOn ?? "—"}</span>
        </span>
      ),
      header: "Fechas",
      id: "dates",
    },
    {
      cell: (requirement) => (
        <StatusBadge
          label={requirementStatusLabels[requirement.status]}
          tone={requirementStatusTones[requirement.status]}
        />
      ),
      header: "Estado",
      id: "status",
    },
    {
      align: "right",
      cell: (requirement) => (
        <div className="flex min-w-[12rem] flex-wrap justify-end gap-2">
          <Button onClick={() => onView(requirement)} size="sm" variant="quiet">
            Ver detalle
          </Button>
          {canManageRequirements ? (
            <>
              <Button onClick={() => onEdit(requirement)} size="sm" variant="secondary">
                Editar
              </Button>
              <Button onClick={() => onDelete(requirement)} size="sm" variant="quiet">
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
