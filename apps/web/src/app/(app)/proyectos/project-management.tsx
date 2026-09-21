"use client";

import { useEffect, useMemo, useState } from "react";

import { ProjectDeleteDialog } from "./project-delete-dialog";
import { ProjectEditorDialog, type ProjectEditorMode } from "./project-editor-dialog";
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
  listProjects,
  type Project,
  type ProjectList,
  type ProjectStatus,
  type ProjectStatusFilter,
} from "../../../lib/projects-client";

type ProjectListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; list: ProjectList }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ClientOptionsState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ clients: readonly Client[]; kind: "ready" }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;

type ProjectEditorState = Readonly<{
  mode: ProjectEditorMode;
  project: Project | null;
}>;

type ProjectManagementProps = Readonly<{
  canManageProjects: boolean;
}>;

const projectStatusLabels: Record<ProjectStatus, string> = {
  active: "Activo",
  cancelled: "Cancelado",
  finalized: "Finalizado",
  paused: "Pausado",
  planned: "Planeado",
};

const projectStatusTones: Record<ProjectStatus, StatusBadgeTone> = {
  active: "success",
  cancelled: "danger",
  finalized: "info",
  paused: "warning",
  planned: "neutral",
};

export function ProjectManagement({ canManageProjects }: ProjectManagementProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientFilterId, setClientFilterId] = useState("all");
  const [clientOptionsState, setClientOptionsState] = useState<ClientOptionsState>({
    kind: "loading",
  });
  const [editor, setEditor] = useState<ProjectEditorState | null>(null);
  const [page, setPage] = useState(1);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ProjectListState>({ kind: "loading" });
  const [status, setStatus] = useState<ProjectStatusFilter>("all");
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
      const result = await listProjects({
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
    nextStatus: ProjectStatusFilter,
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
    canManageProjects,
    (project) => setEditor({ mode: "view", project }),
    (project) => setEditor({ mode: "edit", project }),
    (project) => setProjectToDelete(project),
  );

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <PageHeader
        actions={
          canManageProjects ? (
            <Button
              onClick={() => {
                setActionError(null);
                setEditor({ mode: "create", project: null });
                setUpdateMessage(null);
              }}
            >
              Crear Proyecto
            </Button>
          ) : undefined
        }
        description="Registra el trabajo acordado con cada Cliente y conserva sus fechas, estado y código operativo."
        title="Proyectos"
      />

      <section aria-labelledby="project-search-title" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              className="text-xl font-semibold tracking-tight text-foreground"
              id="project-search-title"
            >
              Cartera de Proyectos
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Filtra por Cliente y estado, o busca por código y nombre para encontrar el trabajo en
              curso e histórico.
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
            label="Buscar Proyectos"
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
              updateFilters(query, event.target.value as ProjectStatusFilter, clientFilterId)
            }
            value={status}
          >
            <option value="all">Todos</option>
            {Object.entries(projectStatusLabels).map(([value, label]) => (
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
          Tu sesión ya no permite consultar los Clientes necesarios para crear un Proyecto.
        </p>
      ) : null}
      {state.kind === "loading" ? <LoadingState title="Consultando Proyectos" /> : null}
      {state.kind === "unauthorized" ? (
        <UnauthorizedState description="Tu sesión ya no permite consultar Proyectos." />
      ) : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={retry}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar los Proyectos"
        />
      ) : null}
      {list && list.projects.length === 0 ? (
        <EmptyState
          action={
            canManageProjects && !query.trim() && status === "all" && clientFilterId === "all" ? (
              <Button
                onClick={() => {
                  setActionError(null);
                  setEditor({ mode: "create", project: null });
                  setUpdateMessage(null);
                }}
              >
                Crear primer Proyecto
              </Button>
            ) : undefined
          }
          description={
            query.trim() || status !== "all" || clientFilterId !== "all"
              ? "No hay Proyectos que coincidan con los filtros seleccionados."
              : "Crea el primer Proyecto para registrar el trabajo comprometido con un Cliente activo."
          }
          title={
            query.trim() || status !== "all" || clientFilterId !== "all"
              ? "No encontramos Proyectos"
              : "Aún no hay Proyectos"
          }
        />
      ) : null}
      {list && list.projects.length > 0 ? (
        <section aria-labelledby="project-table-title" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-foreground" id="project-table-title">
              {list.total} {list.total === 1 ? "Proyecto" : "Proyectos"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Página {list.page} de {totalPages}
            </p>
          </div>
          <DataTable columns={columns} label="Proyectos registrados" rows={list.projects} />
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
        <ProjectEditorDialog
          mode={editor.mode}
          onOpenChange={(open) => {
            if (!open) {
              setEditor(null);
            }
          }}
          onProjectSaved={(project, created) => {
            refreshWithMessage(
              created ? `Se creó ${project.name}.` : `Se actualizó ${project.name}.`,
            );
          }}
          open={editor !== null}
          project={editor.project}
        />
      ) : null}
      {projectToDelete ? (
        <ProjectDeleteDialog
          onDeleted={() => refreshWithMessage(`Se eliminó ${projectToDelete.name}.`)}
          onOpenChange={(open) => {
            if (!open) {
              setProjectToDelete(null);
            }
          }}
          open={projectToDelete !== null}
          project={projectToDelete}
        />
      ) : null}
    </div>
  );
}

function createColumns(
  canManageProjects: boolean,
  onView: (project: Project) => void,
  onEdit: (project: Project) => void,
  onDelete: (project: Project) => void,
): DataTableColumn<Project>[] {
  return [
    {
      cell: (project) => (
        <span className="font-semibold tabular-nums text-primary">{project.code}</span>
      ),
      header: "Código",
      id: "code",
    },
    {
      cell: (project) => <span className="font-semibold text-foreground">{project.name}</span>,
      header: "Proyecto",
      id: "name",
    },
    {
      cell: (project) => (
        <span className="text-sm text-foreground">
          <span className="font-medium">{project.client.name}</span>
          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
            {project.client.code}
          </span>
        </span>
      ),
      header: "Cliente",
      id: "client",
    },
    {
      cell: (project) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {project.startDate} — {project.committedEndDate}
        </span>
      ),
      header: "Fechas",
      id: "dates",
    },
    {
      cell: (project) => (
        <StatusBadge
          label={projectStatusLabels[project.status]}
          tone={projectStatusTones[project.status]}
        />
      ),
      header: "Estado",
      id: "status",
    },
    {
      align: "right",
      cell: (project) => (
        <div className="flex min-w-[12rem] flex-wrap justify-end gap-2">
          <Button onClick={() => onView(project)} size="sm" variant="ghost">
            Ver detalle
          </Button>
          {canManageProjects ? (
            <>
              <Button onClick={() => onEdit(project)} size="sm" variant="secondary">
                Editar
              </Button>
              <Button onClick={() => onDelete(project)} size="sm" variant="ghost">
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
