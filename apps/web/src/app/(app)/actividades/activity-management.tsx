"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import type { VisibilityState } from "@tanstack/react-table";

import { ActivityDeleteDialog } from "./activity-delete-dialog";
import { ActivitySheet, type ActivitySheetMode } from "./activity-sheet";
import { Icons } from "../../../components/icons";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  UnauthorizedState,
} from "../../../components/states/interface-states";
import { Button } from "../../../components/ui/button";
import { DataTable, type DataTableColumn } from "../../../components/ui/data-table";
import { ColumnVisibilityOptions } from "../../../components/ui/table/data-table-view-options";
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
import { StatusBadge, type StatusBadgeTone } from "../../../components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import {
  activityPriorities,
  activityStatuses,
  listActivityAssignees,
  listActivities,
  moveActivity,
  type Activity,
  type ActivityList,
  type ActivityPriority,
  type ActivityStatus,
} from "../../../lib/activities-client";
import { activityStatusTones } from "../../../lib/activity-status-presentation";
import {
  listActivityCategories,
  type ActivityCategory,
} from "../../../lib/activity-categories-client";
import { listClients } from "../../../lib/clients-client";

type ActivityListState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; list: ActivityList }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "error"; message: string }>;
type ActivityEditorState = Readonly<{ activity: Activity | null; mode: ActivitySheetMode }>;
type ActivityGrouping = "none" | "container";
type ActivityContainerGroup = Readonly<{
  id: string;
  activities: readonly Activity[];
  clientName: string;
  containerName: string;
  containerType: Activity["containerType"];
  estimatedHours: number;
}>;

const statusLabels: Record<ActivityStatus, string> = {
  blocked: "Bloqueada",
  customer_testing: "Pruebas cliente",
  finalized: "Finalizada",
  in_progress: "En progreso",
  in_review: "En revisión",
  pending: "Pendiente",
  waiting_third_party: "Esperando tercero",
};
const priorityLabels: Record<ActivityPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  low: "Baja",
  medium: "Media",
};
const containerTypeLabels: Record<"all" | Activity["containerType"], string> = {
  all: "Todos",
  project: "Proyectos",
  requirement: "Requerimientos",
  ticket: "Tickets",
};
const statusTones: Record<ActivityStatus, StatusBadgeTone> = activityStatusTones;
const priorityTones: Record<ActivityPriority, StatusBadgeTone> = {
  critical: "danger",
  high: "warning",
  low: "success",
  medium: "planned",
};

export function ActivityManagement({
  canManageActivities,
}: Readonly<{ canManageActivities: boolean }>) {
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [activityCategoryId, setActivityCategoryId] = useState("all");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [categoryState, setCategoryState] = useState<readonly ActivityCategory[]>([]);
  const [clientId, setClientId] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [collapsedContainerIds, setCollapsedContainerIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [containerId, setContainerId] = useState("");
  const [containerType, setContainerType] = useState<"all" | Activity["containerType"]>("all");
  const [editor, setEditor] = useState<ActivityEditorState | null>(null);
  const [grouping, setGrouping] = useState<ActivityGrouping>("none");
  const [page, setPage] = useState(1);
  const [priority, setPriority] = useState<"all" | ActivityPriority>("all");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ActivityListState>({ kind: "loading" });
  const [status, setStatus] = useState<"all" | ActivityStatus>("all");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void listActivityCategories().then((result) => {
      if (current && result.kind === "success") setCategoryState(result.data);
    });
    return () => {
      current = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let current = true;
    const timeout = window.setTimeout(async () => {
      const result = await listActivities({
        activityCategoryId: activityCategoryId === "all" ? undefined : activityCategoryId,
        assignedUserId,
        clientId,
        containerId,
        containerType: containerType === "all" ? undefined : containerType,
        page,
        priority: priority === "all" ? undefined : priority,
        query,
        status: status === "all" ? undefined : status,
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
  }, [
    activityCategoryId,
    assignedUserId,
    clientId,
    containerId,
    containerType,
    page,
    priority,
    query,
    reloadKey,
    status,
  ]);

  const list = state.kind === "ready" ? state.list : null;
  const categoryNames = useMemo(
    () => new Map(categoryState.map((category) => [category.id, category.name])),
    [categoryState],
  );
  const hasFilters =
    query.trim() ||
    clientId.trim() ||
    containerId.trim() ||
    assignedUserId.trim() ||
    activityCategoryId !== "all" ||
    containerType !== "all" ||
    priority !== "all" ||
    status !== "all";
  const refresh = (message: string) => {
    setUpdateMessage(message);
    setReloadKey((value) => value + 1);
  };
  const updateFilters = (next: {
    activityCategoryId?: string;
    assignedUserId?: string;
    clientId?: string;
    containerId?: string;
    containerType?: "all" | Activity["containerType"];
    priority?: "all" | ActivityPriority;
    query?: string;
    status?: "all" | ActivityStatus;
  }) => {
    setPage(1);
    if (next.activityCategoryId !== undefined) setActivityCategoryId(next.activityCategoryId);
    if (next.assignedUserId !== undefined) setAssignedUserId(next.assignedUserId);
    if (next.clientId !== undefined) setClientId(next.clientId);
    if (next.containerId !== undefined) setContainerId(next.containerId);
    if (next.containerType !== undefined) setContainerType(next.containerType);
    if (next.priority !== undefined) setPriority(next.priority);
    if (next.query !== undefined) setQuery(next.query);
    if (next.status !== undefined) setStatus(next.status);
    setUpdateMessage(null);
  };
  const columns = createColumns({
    canManage: canManageActivities,
    categoryNames,
    onDelete: setActivityToDelete,
    onEdit: (activity) => setEditor({ activity, mode: "edit" }),
    onMove: async (activity, direction) => {
      const result = await moveActivity(activity.id, direction, activity.version);
      if (result.kind === "success") refresh(`Se actualizó la secuencia de ${activity.name}.`);
      else
        setUpdateMessage(
          result.kind === "conflict" ? result.message : "No fue posible mover la Actividad.",
        );
    },
    onView: (activity) => setEditor({ activity, mode: "view" }),
  });
  const visibleColumns = columns.filter(
    (column) => !column.hideable || columnVisibility[column.id] !== false,
  );
  const columnVisibilityOptions = columns
    .filter((column) => column.hideable)
    .map((column) => ({
      id: column.id,
      label: column.header,
      visible: columnVisibility[column.id] !== false,
    }));
  const toggleColumnVisibility = (columnId: string) => {
    setColumnVisibility((current) => {
      const next = { ...current };
      next[columnId] = current[columnId] === false;
      return next;
    });
  };
  const containerGroups = useMemo(
    () => (list ? groupActivitiesByContainer(list.activities) : []),
    [list],
  );
  const activityFilters = (
    <ActivityFilters
      activityCategoryId={activityCategoryId}
      assignedUserId={assignedUserId}
      categories={categoryState}
      clientId={clientId}
      containerType={containerType}
      grouping={grouping}
      hasFilters={Boolean(hasFilters)}
      onChange={updateFilters}
      onGroupingChange={setGrouping}
      priority={priority}
      query={query}
      status={status}
    />
  );

  return (
    <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
      <div className="shrink-0 space-y-4 pb-4">
        <PageHeader
          actions={
            canManageActivities ? (
              <Button onClick={() => setEditor({ activity: null, mode: "create" })}>
                <Icons.add />
                Crear Actividad
              </Button>
            ) : undefined
          }
          title="Actividades"
        />
        {updateMessage ? (
          <p aria-live="polite" className="text-sm font-medium text-success">
            {updateMessage}
          </p>
        ) : null}
      </div>
      {state.kind === "loading" ? <LoadingState title="Consultando Actividades" /> : null}
      {state.kind === "unauthorized" ? (
        <UnauthorizedState description="Tu sesión ya no permite consultar Actividades." />
      ) : null}
      {state.kind === "error" ? (
        <ErrorState
          action={<Button onClick={() => setReloadKey((value) => value + 1)}>Reintentar</Button>}
          description={state.message}
          title="No fue posible consultar las Actividades"
        />
      ) : null}
      {list ? (
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
          aria-labelledby="activity-table-title"
        >
          <h2 className="sr-only" id="activity-table-title">
            Actividades registradas
          </h2>
          {list.activities.length ? (
            grouping === "container" ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                {activityFilters}
                <ActivityGroupedTable
                  collapsedContainerIds={collapsedContainerIds}
                  columns={visibleColumns}
                  columnVisibilityOptions={columnVisibilityOptions}
                  groups={containerGroups}
                  onToggleContainer={(containerGroupId) =>
                    setCollapsedContainerIds((current) => {
                      const next = new Set(current);
                      if (next.has(containerGroupId)) next.delete(containerGroupId);
                      else next.add(containerGroupId);
                      return next;
                    })
                  }
                  onToggleColumnVisibility={toggleColumnVisibility}
                />
              </div>
            ) : (
              <DataTable
                className="min-h-0 min-w-0 flex-1"
                columnVisibility={columnVisibility}
                columns={columns}
                label="Actividades registradas"
                rows={list.activities}
                scrollable
                showViewOptions
                toolbar={activityFilters}
                onColumnVisibilityChange={setColumnVisibility}
              />
            )
          ) : (
            <>
              {activityFilters}
              <EmptyState
                action={
                  canManageActivities && !hasFilters ? (
                    <Button onClick={() => setEditor({ activity: null, mode: "create" })}>
                      Crear primera Actividad
                    </Button>
                  ) : undefined
                }
                description={
                  hasFilters
                    ? "No hay Actividades que coincidan con los filtros seleccionados."
                    : "Registra una Actividad para organizar el trabajo de un Proyecto, Requerimiento o Ticket."
                }
                title={hasFilters ? "No encontramos Actividades" : "Aún no hay Actividades"}
              />
            </>
          )}
          <ActivityPagination
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            onPageChange={setPage}
          />
        </section>
      ) : null}
      {editor ? (
        <ActivitySheet
          activity={editor.activity}
          canManage={canManageActivities}
          mode={editor.mode}
          onOpenChange={(open) => !open && setEditor(null)}
          onSaved={(activity, created) =>
            refresh(created ? `Se creó ${activity.name}.` : `Se actualizó ${activity.name}.`)
          }
          open
        />
      ) : null}
      {activityToDelete ? (
        <ActivityDeleteDialog
          activity={activityToDelete}
          onDeleted={() => refresh(`Se eliminó ${activityToDelete.name}.`)}
          onOpenChange={(open) => !open && setActivityToDelete(null)}
          open
        />
      ) : null}
    </div>
  );
}

function ActivityFilters({
  activityCategoryId,
  assignedUserId,
  categories,
  clientId,
  containerType,
  grouping,
  hasFilters,
  onChange,
  onGroupingChange,
  priority,
  query,
  status,
}: Readonly<{
  activityCategoryId: string;
  assignedUserId: string;
  categories: readonly ActivityCategory[];
  clientId: string;
  containerType: "all" | Activity["containerType"];
  grouping: ActivityGrouping;
  hasFilters: boolean;
  onChange: (next: {
    activityCategoryId?: string;
    assignedUserId?: string;
    clientId?: string;
    containerId?: string;
    containerType?: "all" | Activity["containerType"];
    priority?: "all" | ActivityPriority;
    query?: string;
    status?: "all" | ActivityStatus;
  }) => void;
  onGroupingChange: (grouping: ActivityGrouping) => void;
  priority: "all" | ActivityPriority;
  query: string;
  status: "all" | ActivityStatus;
}>) {
  return (
    <div
      aria-label="Buscar y filtrar Actividades"
      className="flex flex-wrap items-center gap-2"
      role="search"
    >
      <label className="sr-only" htmlFor="activity-search">
        Buscar Actividades
      </label>
      <Input
        autoComplete="off"
        className="w-full sm:w-72"
        id="activity-search"
        onChange={(event) => onChange({ query: event.target.value })}
        placeholder="Buscar Actividades..."
        type="search"
        value={query}
      />
      <ActivitySearchFilterMenu
        label="Cliente"
        onValueChange={(value) => onChange({ clientId: value })}
        value={clientId}
      />
      <ActivityFilterMenu
        items={[
          { label: "Todos", value: "all" },
          ...Object.entries(containerTypeLabels)
            .filter(([value]) => value !== "all")
            .map(([value, label]) => ({ label, value })),
        ]}
        label="Contenedor"
        onValueChange={(value) =>
          onChange({ containerType: value as "all" | Activity["containerType"] })
        }
        value={containerType}
        valueLabel={containerType === "all" ? undefined : containerTypeLabels[containerType]}
      />
      <ActivitySearchFilterMenu
        label="Responsable"
        onValueChange={(value) => onChange({ assignedUserId: value })}
        value={assignedUserId}
      />
      <ActivityFilterMenu
        items={[
          { label: "Todas", value: "all" },
          ...categories.map((category) => ({ label: category.name, value: category.id })),
        ]}
        label="Categoría"
        onValueChange={(value) => onChange({ activityCategoryId: value })}
        value={activityCategoryId}
        valueLabel={categories.find((category) => category.id === activityCategoryId)?.name}
      />
      <ActivityFilterMenu
        items={[
          { label: "Todos", value: "all" },
          ...activityStatuses.map((value) => ({ label: statusLabels[value], value })),
        ]}
        label="Estado"
        onValueChange={(value) => onChange({ status: value as "all" | ActivityStatus })}
        value={status}
        valueLabel={status === "all" ? undefined : statusLabels[status]}
      />
      <ActivityFilterMenu
        items={[
          { label: "Todas", value: "all" },
          ...activityPriorities.map((value) => ({ label: priorityLabels[value], value })),
        ]}
        label="Prioridad"
        onValueChange={(value) => onChange({ priority: value as "all" | ActivityPriority })}
        value={priority}
        valueLabel={priority === "all" ? undefined : priorityLabels[priority]}
      />
      <ActivityFilterMenu
        icon={Icons.group}
        items={[
          { label: "Sin agrupar", value: "none" },
          { label: "Por contenedor", value: "container" },
        ]}
        label="Agrupar"
        onValueChange={(value) => onGroupingChange(value as ActivityGrouping)}
        value={grouping}
        valueLabel={grouping === "container" ? "Por contenedor" : undefined}
      />
      {hasFilters ? (
        <Button
          onClick={() =>
            onChange({
              activityCategoryId: "all",
              assignedUserId: "",
              clientId: "",
              containerId: "",
              containerType: "all",
              priority: "all",
              query: "",
              status: "all",
            })
          }
          size="sm"
          variant="ghost"
        >
          <Icons.close />
          Restablecer
        </Button>
      ) : null}
    </div>
  );
}

function ActivitySearchFilterMenu({
  label,
  onValueChange,
  value,
}: Readonly<{
  label: "Cliente" | "Responsable";
  onValueChange: (value: string) => void;
  value: string;
}>) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<readonly Readonly<{ label: string; value: string }>[]>([]);
  const [query, setQuery] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let current = true;
    setIsLoading(true);
    const timeout = window.setTimeout(async () => {
      if (label === "Cliente") {
        const result = await listClients({ query, status: "all" });
        if (!current) return;
        setOptions(
          result.kind === "success"
            ? result.data.clients.map((client) => ({
                label: `${client.code} · ${client.name}`,
                value: client.id,
              }))
            : [],
        );
      } else {
        const result = await listActivityAssignees(query);
        if (!current) return;
        setOptions(
          result.kind === "success"
            ? result.data.map((assignee) => ({ label: assignee.name, value: assignee.id }))
            : [],
        );
      }
      setIsLoading(false);
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [isOpen, label, query]);

  return (
    <DropdownMenu onOpenChange={setIsOpen} open={isOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Icons.adjustments />
          {label}
          {value && selectedLabel ? (
            <span className="max-w-40 truncate text-primary">{selectedLabel}</span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <Input
          aria-label={`Buscar ${label}`}
          autoFocus
          className="mb-2"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          placeholder={`Buscar ${label.toLowerCase()}…`}
          value={query}
        />
        <DropdownMenuRadioGroup
          onValueChange={(next) => {
            const selected = options.find((option) => option.value === next);
            setSelectedLabel(selected?.label ?? null);
            onValueChange(next === "all" ? "" : next);
            setIsOpen(false);
          }}
          value={value || "all"}
        >
          <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
          {isLoading ? <p className="px-2 py-1 text-sm text-muted-foreground">Buscando…</p> : null}
          {!isLoading && options.length === 0 ? (
            <p className="px-2 py-1 text-sm text-muted-foreground">No hay resultados.</p>
          ) : null}
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityFilterMenu({
  icon: MenuIcon = Icons.adjustments,
  items,
  label,
  onValueChange,
  value,
  valueLabel,
}: Readonly<{
  icon?: typeof Icons.adjustments;
  items: readonly Readonly<{ label: string; value: string }>[];
  label: string;
  onValueChange: (value: string) => void;
  value: string;
  valueLabel?: string;
}>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <MenuIcon />
          {label}
          {valueLabel ? <span className="max-w-40 truncate text-primary">{valueLabel}</span> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>Filtrar por {label.toLowerCase()}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup onValueChange={onValueChange} value={value}>
          {items.map((item) => (
            <DropdownMenuRadioItem key={item.value} value={item.value}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActivityGroupedTable({
  collapsedContainerIds,
  columns,
  columnVisibilityOptions,
  groups,
  onToggleColumnVisibility,
  onToggleContainer,
}: Readonly<{
  collapsedContainerIds: ReadonlySet<string>;
  columns: readonly DataTableColumn<Activity>[];
  columnVisibilityOptions: readonly {
    id: string;
    label: string;
    visible: boolean;
  }[];
  groups: readonly ActivityContainerGroup[];
  onToggleColumnVisibility: (columnId: string) => void;
  onToggleContainer: (containerGroupId: string) => void;
}>) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex justify-end">
        <ColumnVisibilityOptions
          columns={columnVisibilityOptions}
          onToggle={onToggleColumnVisibility}
        />
      </div>
      <div
        aria-label="Actividades agrupadas por contenedor"
        className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border"
      >
        <Table className="min-w-max">
          <TableHeader className="bg-muted sticky top-0 z-10">
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  className={column.align === "right" ? "text-right" : undefined}
                  key={column.id}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              const isCollapsed = collapsedContainerIds.has(group.id);
              return (
                <Fragment key={group.id}>
                  <TableRow className="bg-muted/40 hover:bg-muted/50">
                    <TableCell className="p-0" colSpan={columns.length}>
                      <button
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                        onClick={() => onToggleContainer(group.id)}
                        type="button"
                      >
                        {isCollapsed ? <Icons.chevronRight /> : <Icons.chevronDown />}
                        <span className="font-medium text-foreground">
                          {containerLabels[group.containerType]} · {group.containerName}
                        </span>
                        <span className="text-sm text-muted-foreground">{group.clientName}</span>
                        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                          {group.activities.length}{" "}
                          {group.activities.length === 1 ? "actividad" : "actividades"}
                          {" · "}
                          {formatHours(group.estimatedHours)} h
                        </span>
                      </button>
                    </TableCell>
                  </TableRow>
                  {!isCollapsed
                    ? group.activities.map((activity) => (
                        <TableRow key={activity.id}>
                          {columns.map((column) => (
                            <TableCell
                              className={column.align === "right" ? "text-right" : undefined}
                              key={column.id}
                            >
                              {column.cell(activity)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActivityPagination({
  onPageChange,
  page,
  pageSize,
  total,
}: Readonly<{
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
}>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div
      aria-label="Paginación de Actividades"
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
        <p className="text-sm font-medium text-foreground whitespace-nowrap">
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

function createColumns({
  canManage,
  categoryNames,
  onDelete,
  onEdit,
  onMove,
  onView,
}: Readonly<{
  canManage: boolean;
  categoryNames: ReadonlyMap<string, string>;
  onDelete: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onMove: (activity: Activity, direction: "up" | "down") => void;
  onView: (activity: Activity) => void;
}>): DataTableColumn<Activity>[] {
  return [
    {
      cell: (activity) => <span className="font-semibold text-foreground">{activity.name}</span>,
      header: "Actividad",
      hideable: true,
      id: "name",
      sortValue: (activity) => activity.name,
    },
    {
      cell: (activity) => (
        <StatusBadge label={statusLabels[activity.status]} tone={statusTones[activity.status]} />
      ),
      header: "Estado",
      hideable: true,
      id: "status",
      sortValue: (activity) => activity.status,
    },
    {
      cell: (activity) => (
        <StatusBadge
          label={priorityLabels[activity.priority]}
          tone={priorityTones[activity.priority]}
        />
      ),
      header: "Prioridad",
      hideable: true,
      id: "priority",
      sortValue: (activity) => activity.priority,
    },
    {
      cell: (activity) => (
        <span className="text-sm text-muted-foreground">
          {categoryNames.get(activity.activityCategoryId) ?? "Categoría histórica"}
        </span>
      ),
      header: "Categoría",
      hideable: true,
      id: "category",
    },
    {
      cell: (activity) => (
        <span className="block max-w-40 truncate text-sm">{activity.clientName}</span>
      ),
      header: "Cliente",
      hideable: true,
      id: "client",
      sortValue: (activity) => activity.clientName,
    },
    {
      cell: (activity) => (
        <span className="block max-w-40 truncate text-sm">{activity.assignedUserName}</span>
      ),
      header: "Responsable",
      hideable: true,
      id: "assignee",
      sortValue: (activity) => activity.assignedUserName,
    },
    {
      cell: (activity) => (
        <span className="text-sm text-muted-foreground">
          {containerLabels[activity.containerType]}
          <span className="mt-0.5 block max-w-40 truncate text-xs text-foreground">
            {activity.containerName}
          </span>
        </span>
      ),
      header: "Ubicación",
      hideable: true,
      id: "container",
    },
    {
      cell: (activity) => (
        <span
          className={activity.targetDate ? "tabular-nums text-sm" : "text-sm text-muted-foreground"}
        >
          {activity.targetDate ? formatDateOnly(activity.targetDate) : "Sin fecha"}
        </span>
      ),
      header: "Fecha objetivo",
      hideable: true,
      id: "target-date",
      sortValue: (activity) => activity.targetDate ?? "9999-12-31",
    },
    {
      cell: (activity) => <span className="tabular-nums">{activity.estimatedHours} h</span>,
      header: "Estimación",
      hideable: true,
      id: "estimate",
      sortValue: (activity) => activity.estimatedHours,
    },
    {
      align: "right",
      cell: (activity) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={`Acciones para ${activity.name}`} size="icon" variant="ghost">
              <Icons.ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onView(activity)}>
              <Icons.info />
              Ver detalle
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuItem onSelect={() => onEdit(activity)}>
                  <Icons.edit />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(activity, "up")}>
                  <Icons.chevronUp />
                  Mover arriba
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(activity, "down")}>
                  <Icons.chevronDown />
                  Mover abajo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onDelete(activity)} variant="destructive">
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

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function groupActivitiesByContainer(
  activities: readonly Activity[],
): readonly ActivityContainerGroup[] {
  const groups = new Map<string, ActivityContainerGroup>();
  for (const activity of activities) {
    const id = `${activity.containerType}:${activity.containerId}`;
    const existing = groups.get(id);
    groups.set(
      id,
      existing
        ? {
            ...existing,
            activities: [...existing.activities, activity],
            estimatedHours: existing.estimatedHours + activity.estimatedHours,
          }
        : {
            activities: [activity],
            clientName: activity.clientName || "Sin cliente",
            containerName: activity.containerName,
            containerType: activity.containerType,
            estimatedHours: activity.estimatedHours,
            id,
          },
    );
  }
  return [...groups.values()];
}

function formatHours(value: number): string {
  return new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(value);
}

const containerLabels: Record<Activity["containerType"], string> = {
  project: "Proyecto",
  requirement: "Requerimiento",
  ticket: "Ticket",
};
