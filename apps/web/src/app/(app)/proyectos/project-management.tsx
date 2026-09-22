"use client";

import { useEffect, useMemo, useState } from "react";

import { ProjectDeleteDialog } from "./project-delete-dialog";
import { ProjectEditorDialog, type ProjectEditorMode } from "./project-editor-dialog";
import { Icons } from "../../../components/icons";
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
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
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
  cancelled: "Cancelado",
  finalized: "Finalizado",
  in_execution: "En ejecución",
  new: "Nuevo",
  paused: "Pausado",
};

const projectStatusTones: Record<ProjectStatus, StatusBadgeTone> = {
  cancelled: "danger",
  finalized: "info",
  in_execution: "success",
  new: "planned",
  paused: "paused",
};

const projectStatusFilterLabels: Record<ProjectStatusFilter, string> = {
  all: "Todos",
  ...projectStatusLabels,
};

function isTerminalProject(project: Project): boolean {
  return project.status === "finalized" || project.status === "cancelled";
}

export function ProjectManagement({ canManageProjects }: ProjectManagementProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientFilterId, setClientFilterId] = useState("all");
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
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
  const projectFilters = (
    <div
      aria-label="Buscar y filtrar Proyectos"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="project-search">
        Buscar Proyectos
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="project-search"
        onChange={(event) => updateFilters(event.target.value, status, clientFilterId)}
        placeholder="Buscar Proyectos..."
        type="search"
        value={query}
      />
      <Popover onOpenChange={setIsClientFilterOpen} open={isClientFilterOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Cliente
            {clientFilterId !== "all" ? (
              <span className="max-w-40 truncate text-primary">
                {clientOptions.find((client) => client.id === clientFilterId)?.name}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
          <Command>
            <CommandInput placeholder="Buscar Clientes..." />
            <CommandList>
              <CommandEmpty>No se encontraron Clientes.</CommandEmpty>
              <CommandItem
                onSelect={() => {
                  updateFilters(query, status, "all");
                  setIsClientFilterOpen(false);
                }}
                value="Todos los Clientes"
              >
                <Icons.check
                  className={clientFilterId === "all" ? "size-4 text-primary" : "size-4 opacity-0"}
                />
                Todos los Clientes
              </CommandItem>
              {clientOptions.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => {
                    updateFilters(query, status, client.id);
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
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Icons.adjustments />
            Estado
            {status !== "all" ? (
              <span className="text-primary">{projectStatusFilterLabels[status]}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(nextStatus) =>
              updateFilters(query, nextStatus as ProjectStatusFilter, clientFilterId)
            }
            value={status}
          >
            {(Object.keys(projectStatusFilterLabels) as ProjectStatusFilter[]).map(
              (filterStatus) => (
                <DropdownMenuRadioItem key={filterStatus} value={filterStatus}>
                  {projectStatusFilterLabels[filterStatus]}
                </DropdownMenuRadioItem>
              ),
            )}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {query.trim() || status !== "all" || clientFilterId !== "all" ? (
        <Button onClick={() => updateFilters("", "all", "all")} size="sm" variant="ghost">
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
          title="Proyectos"
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
      </div>

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
        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0">{projectFilters}</div>
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
        </section>
      ) : null}
      {list && list.projects.length > 0 ? (
        <section
          aria-labelledby="project-table-title"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <h2 className="sr-only" id="project-table-title">
            Proyectos registrados
          </h2>
          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            label="Proyectos registrados"
            rows={list.projects}
            scrollable
            showViewOptions
            toolbar={
              <div
                aria-label="Buscar y filtrar Proyectos"
                className="flex flex-wrap items-center gap-2"
                role="search"
              >
                <label className="sr-only" htmlFor="project-search">
                  Buscar Proyectos
                </label>
                <Input
                  autoComplete="off"
                  className="w-full sm:w-72"
                  id="project-search"
                  onChange={(event) => updateFilters(event.target.value, status, clientFilterId)}
                  placeholder="Buscar Proyectos..."
                  type="search"
                  value={query}
                />
                <Popover onOpenChange={setIsClientFilterOpen} open={isClientFilterOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Icons.adjustments />
                      Cliente
                      {clientFilterId !== "all" ? (
                        <span className="max-w-40 truncate text-primary">
                          {clientOptions.find((client) => client.id === clientFilterId)?.name}
                        </span>
                      ) : null}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar Clientes..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron Clientes.</CommandEmpty>
                        <CommandItem
                          onSelect={() => {
                            updateFilters(query, status, "all");
                            setIsClientFilterOpen(false);
                          }}
                          value="Todos los Clientes"
                        >
                          <Icons.check
                            className={
                              clientFilterId === "all" ? "size-4 text-primary" : "size-4 opacity-0"
                            }
                          />
                          Todos los Clientes
                        </CommandItem>
                        {clientOptions.map((client) => (
                          <CommandItem
                            key={client.id}
                            onSelect={() => {
                              updateFilters(query, status, client.id);
                              setIsClientFilterOpen(false);
                            }}
                            value={`${client.code} ${client.name}`}
                          >
                            <Icons.check
                              className={
                                clientFilterId === client.id
                                  ? "size-4 text-primary"
                                  : "size-4 opacity-0"
                              }
                            />
                            {client.code} — {client.name}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Icons.adjustments />
                      Estado
                      {status !== "all" ? (
                        <span className="text-primary">{projectStatusFilterLabels[status]}</span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="min-w-48">
                    <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      onValueChange={(nextStatus) =>
                        updateFilters(query, nextStatus as ProjectStatusFilter, clientFilterId)
                      }
                      value={status}
                    >
                      {(Object.keys(projectStatusFilterLabels) as ProjectStatusFilter[]).map(
                        (filterStatus) => (
                          <DropdownMenuRadioItem key={filterStatus} value={filterStatus}>
                            {projectStatusFilterLabels[filterStatus]}
                          </DropdownMenuRadioItem>
                        ),
                      )}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {query.trim() || status !== "all" || clientFilterId !== "all" ? (
                  <Button onClick={() => updateFilters("", "all", "all")} size="sm" variant="ghost">
                    <Icons.close />
                    Restablecer
                  </Button>
                ) : null}
              </div>
            }
          />
          <div
            aria-label="Paginación de Proyectos"
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
      hideable: true,
      id: "code",
      sortValue: (project) => project.code,
    },
    {
      cell: (project) => <span className="font-semibold text-foreground">{project.name}</span>,
      header: "Proyecto",
      hideable: true,
      id: "name",
      sortValue: (project) => project.name,
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
      hideable: true,
      id: "client",
      sortValue: (project) => project.client.name,
    },
    {
      cell: (project) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {project.startDate} — {project.committedEndDate}
        </span>
      ),
      header: "Fechas",
      hideable: true,
      id: "dates",
      sortValue: (project) => project.startDate,
    },
    {
      cell: (project) => (
        <StatusBadge
          label={projectStatusLabels[project.status]}
          tone={projectStatusTones[project.status]}
        />
      ),
      header: "Estado",
      hideable: true,
      id: "status",
      sortValue: (project) => projectStatusLabels[project.status],
    },
    {
      align: "right",
      cell: (project) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Acciones para ${project.name}`} size="icon" variant="ghost">
              <Icons.ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => onView(project)}>
              <Icons.info />
              Ver detalle
            </DropdownMenuItem>
            {canManageProjects ? (
              <>
                {!isTerminalProject(project) ? (
                  <DropdownMenuItem onSelect={() => onEdit(project)}>
                    <Icons.edit />
                    Editar
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(project)} variant="destructive">
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
