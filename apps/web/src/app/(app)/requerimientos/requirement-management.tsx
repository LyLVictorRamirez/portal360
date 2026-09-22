"use client";

import { useEffect, useMemo, useState } from "react";

import { RequirementDeleteDialog } from "./requirement-delete-dialog";
import { RequirementEditorDialog, type RequirementEditorMode } from "./requirement-editor-dialog";
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
import { Input } from "../../../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
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
  finalized: "Finalizado",
  in_analysis: "En análisis",
  in_execution: "En ejecución",
  new: "Nuevo",
  paused: "Pausado",
  quoted: "Cotizado",
};

const requirementStatusTones: Record<RequirementStatus, StatusBadgeTone> = {
  approved: "success",
  cancelled: "danger",
  finalized: "info",
  in_analysis: "warning",
  in_execution: "success",
  new: "planned",
  paused: "warning",
  quoted: "quoted",
};

const requirementStatusFilterLabels: Record<RequirementStatusFilter, string> = {
  all: "Todos",
  ...requirementStatusLabels,
};

export function RequirementManagement({ canManageRequirements }: RequirementManagementProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const [clientFilterId, setClientFilterId] = useState("all");
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
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
  const requirementFilters = (
    <div
      aria-label="Buscar y filtrar Requerimientos"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="requirement-search">
        Buscar Requerimientos
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="requirement-search"
        onChange={(event) => updateFilters(event.target.value, status, clientFilterId)}
        placeholder="Buscar Requerimientos..."
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
              <span className="text-primary">{requirementStatusFilterLabels[status]}</span>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-48">
          <DropdownMenuLabel>Filtrar por estado</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            onValueChange={(nextStatus) =>
              updateFilters(query, nextStatus as RequirementStatusFilter, clientFilterId)
            }
            value={status}
          >
            {(Object.keys(requirementStatusFilterLabels) as RequirementStatusFilter[]).map(
              (filterStatus) => (
                <DropdownMenuRadioItem key={filterStatus} value={filterStatus}>
                  {requirementStatusFilterLabels[filterStatus]}
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
          title="Requerimientos"
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
        <section className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="shrink-0">{requirementFilters}</div>
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
        </section>
      ) : null}
      {list && list.requirements.length > 0 ? (
        <section
          aria-labelledby="requirement-table-title"
          className="flex min-h-0 flex-1 flex-col gap-4"
        >
          <h2 className="sr-only" id="requirement-table-title">
            Requerimientos registrados
          </h2>
          <DataTable
            className="min-h-0 flex-1"
            columns={columns}
            label="Requerimientos registrados"
            rows={list.requirements}
            scrollable
            showViewOptions
            toolbar={requirementFilters}
          />
          <div
            aria-label="Paginación de Requerimientos"
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
      hideable: true,
      id: "code",
      sortValue: (requirement) => requirement.code,
    },
    {
      cell: (requirement) => (
        <span className="font-semibold text-foreground">{requirement.name}</span>
      ),
      header: "Requerimiento",
      hideable: true,
      id: "name",
      sortValue: (requirement) => requirement.name,
    },
    {
      cell: (requirement) => (
        <span className="text-sm text-foreground">
          <span className="font-medium">{requirement.client.name}</span>
          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
            {requirement.client.code}
          </span>
        </span>
      ),
      header: "Cliente",
      hideable: true,
      id: "client",
      sortValue: (requirement) => requirement.client.name,
    },
    {
      cell: (requirement) => (
        <span className="whitespace-nowrap text-muted-foreground">
          Solicitud: {requirement.requestedOn}
          <span className="mt-0.5 block">Compromiso: {requirement.committedOn ?? "—"}</span>
        </span>
      ),
      header: "Fechas",
      hideable: true,
      id: "dates",
      sortValue: (requirement) => requirement.requestedOn,
    },
    {
      cell: (requirement) => (
        <StatusBadge
          label={requirementStatusLabels[requirement.status]}
          tone={requirementStatusTones[requirement.status]}
        />
      ),
      header: "Estado",
      hideable: true,
      id: "status",
      sortValue: (requirement) => requirementStatusLabels[requirement.status],
    },
    {
      align: "right",
      cell: (requirement) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Acciones para ${requirement.name}`} size="icon" variant="ghost">
              <Icons.ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onView(requirement)}>
              <Icons.info />
              Ver detalle
            </DropdownMenuItem>
            {canManageRequirements ? (
              <>
                <DropdownMenuItem onSelect={() => onEdit(requirement)}>
                  <Icons.edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(requirement)} variant="destructive">
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
