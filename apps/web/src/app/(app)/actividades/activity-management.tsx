"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { VisibilityState } from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

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
  activityPriorities,
  activityStatuses,
  listActivityAssignees,
  listActivityTree,
  relocateActivity,
  type Activity,
  type ActivityTree,
  type ActivityTreeItem,
  type ActivityPriority,
  type ActivityStatus,
} from "../../../lib/activities-client";
import { activityStatusTones } from "../../../lib/activity-status-presentation";
import {
  listActivityCategories,
  type ActivityCategory,
} from "../../../lib/activity-categories-client";
import { listClients } from "../../../lib/clients-client";

type ActivityTreeState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "ready"; tree: ActivityTree }>
  | Readonly<{ kind: "unauthorized" }>
  | Readonly<{ kind: "refine"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;
type ActivityEditorState = Readonly<{ activity: Activity | null; mode: ActivitySheetMode }>;
type ActivityRelocationPlacement = "before" | "after" | "inside" | "last";
type ActivityTreeMetadata = Readonly<{ childCount: number; depth: number; subtreeHeight: number }>;

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
const dropPlacementLabels: Record<Exclude<ActivityRelocationPlacement, "last">, string> = {
  after: "Después",
  before: "Antes",
  inside: "Dentro",
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
  const [containerId, setContainerId] = useState("");
  const [containerType, setContainerType] = useState<"all" | Activity["containerType"]>("all");
  const [editor, setEditor] = useState<ActivityEditorState | null>(null);
  const [priority, setPriority] = useState<"all" | ActivityPriority>("all");
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<ActivityTreeState>({ kind: "loading" });
  const [status, setStatus] = useState<"all" | ActivityStatus>("all");
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [expandedActivityIds, setExpandedActivityIds] = useState<ReadonlySet<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const expansionLoaded = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("portal-360:activities:expanded-v1");
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
        setExpandedActivityIds(new Set(parsed));
      }
    } catch {
      // The tree remains usable when local preferences cannot be read.
    } finally {
      expansionLoaded.current = true;
    }
  }, []);

  useEffect(() => {
    if (!expansionLoaded.current) return;
    try {
      window.localStorage.setItem(
        "portal-360:activities:expanded-v1",
        JSON.stringify([...expandedActivityIds]),
      );
    } catch {
      // Local preference persistence is optional.
    }
  }, [expandedActivityIds]);

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
      const result = await listActivityTree({
        activityCategoryId: activityCategoryId === "all" ? undefined : activityCategoryId,
        assignedUserId,
        clientId,
        containerId,
        containerType: containerType === "all" ? undefined : containerType,
        priority: priority === "all" ? undefined : priority,
        query,
        status: status === "all" ? undefined : status,
      });
      if (!current) return;
      setState(
        result.kind === "success"
          ? { kind: "ready", tree: result.data }
          : result.kind === "unauthorized"
            ? result
            : result.kind === "validation"
              ? { kind: "refine", message: result.message }
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
    priority,
    query,
    reloadKey,
    status,
  ]);

  const tree = state.kind === "ready" ? state.tree : null;
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
  const treeRows = useMemo(
    () => visibleTreeActivities(tree?.activities ?? [], expandedActivityIds, Boolean(hasFilters)),
    [expandedActivityIds, hasFilters, tree?.activities],
  );
  const groupedTreeRows = useMemo(() => groupActivitiesByContainer(treeRows), [treeRows]);
  const treeMeta = useMemo(() => treeMetadata(tree?.activities ?? []), [tree?.activities]);
  const activitiesById = useMemo(
    () => new Map((tree?.activities ?? []).map((activity) => [activity.id, activity])),
    [tree?.activities],
  );
  const activeDragActivity = activeDragId ? (activitiesById.get(activeDragId) ?? null) : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const relocate = async (
    activity: Activity,
    placement: ActivityRelocationPlacement,
    targetActivityId: string | null,
  ) => {
    const result = await relocateActivity(activity.id, {
      placement,
      targetActivityId,
      version: activity.version,
    });
    if (result.kind === "success") refresh(`Se reubicó ${activity.name}.`);
    else
      setUpdateMessage(
        result.kind === "conflict" ? result.message : "No fue posible reubicar la Actividad.",
      );
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const [targetId, placement] = String(event.over?.id ?? "").split("|");
    const activity = tree?.activities.find((item) => item.id === event.active.id);
    if (!activity || !targetId) return;
    if (placement === "last" && targetId === activity.containerId) {
      void relocate(activity, placement, null);
      return;
    }
    const target = activitiesById.get(targetId);
    if (
      target &&
      (placement === "before" || placement === "after" || placement === "inside") &&
      isValidDropTarget(activity, target, placement, treeMeta, activitiesById)
    ) {
      void relocate(activity, placement, targetId);
    }
  };
  const dragAccessibility = useMemo(
    () => ({
      announcements: {
        onDragCancel: ({ active }: { active: { id: string | number } }) =>
          `Se canceló el movimiento de ${activitiesById.get(String(active.id))?.name ?? "la Actividad"}.`,
        onDragEnd: ({
          active,
          over,
        }: {
          active: { id: string | number };
          over: { id: string | number } | null;
        }) =>
          over
            ? `Se soltó ${activitiesById.get(String(active.id))?.name ?? "la Actividad"} en ${dropTargetAnnouncement(String(over.id), activitiesById)}.`
            : "No se eligió un destino para la Actividad.",
        onDragOver: ({ over }: { over: { id: string | number } | null }) =>
          over ? `Destino: ${dropTargetAnnouncement(String(over.id), activitiesById)}.` : undefined,
        onDragStart: ({ active }: { active: { id: string | number } }) =>
          `Se seleccionó ${activitiesById.get(String(active.id))?.name ?? "la Actividad"}.`,
      },
      screenReaderInstructions: {
        draggable:
          "Presiona la barra espaciadora para tomar una Actividad. Usa las flechas para elegir un destino y barra espaciadora para soltarla. Presiona Escape para cancelar.",
      },
    }),
    [activitiesById],
  );
  const columns = createColumns({
    canManage: canManageActivities,
    categoryNames,
    expandedActivityIds,
    activeDragActivity,
    getDropPlacements: (target) =>
      activeDragActivity
        ? getValidDropPlacements(activeDragActivity, target, treeMeta, activitiesById)
        : [],
    onMoveToRoot: (activity) => void relocate(activity, "last", null),
    onToggleExpanded: (activityId) =>
      setExpandedActivityIds((current) => {
        const next = new Set(current);
        if (next.has(activityId)) next.delete(activityId);
        else next.add(activityId);
        return next;
      }),
    onDelete: setActivityToDelete,
    onEdit: (activity) => setEditor({ activity, mode: "edit" }),
    treeMeta,
    onView: (activity) => setEditor({ activity, mode: "view" }),
  });
  const activityFilters = (
    <ActivityFilters
      activityCategoryId={activityCategoryId}
      assignedUserId={assignedUserId}
      categories={categoryState}
      clientId={clientId}
      containerType={containerType}
      hasFilters={Boolean(hasFilters)}
      onChange={updateFilters}
      priority={priority}
      query={query}
      status={status}
    />
  );

  return (
    <div className="flex h-[calc(100svh-5.5rem)] min-h-0 min-w-0 w-full flex-col">
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
      {state.kind === "refine" ? (
        <ErrorState
          action={<Button onClick={() => setQuery("")}>Restablecer filtros</Button>}
          description={state.message}
          title="Refina los filtros para consultar el árbol"
        />
      ) : null}
      {tree ? (
        <section
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden"
          aria-labelledby="activity-table-title"
        >
          <h2 className="sr-only" id="activity-table-title">
            Actividades registradas
          </h2>
          {tree.activities.length ? (
            <DndContext
              accessibility={dragAccessibility}
              onDragCancel={() => setActiveDragId(null)}
              onDragEnd={onDragEnd}
              onDragStart={(event) => setActiveDragId(String(event.active.id))}
              sensors={sensors}
            >
              <DataTable
                className="min-h-0 min-w-0 flex-1"
                columnVisibility={columnVisibility}
                columns={columns}
                groupBy={(activity) => activity.containerId}
                label="Árbol de Actividades"
                paginate={false}
                renderGroupHeader={(activity) => (
                  <ActivityContainerBand
                    activity={activity}
                    activeDragActivity={activeDragActivity}
                  />
                )}
                renderSubgroupHeader={(activity) => (
                  <ActivityProjectStageBand activity={activity} />
                )}
                rows={groupedTreeRows}
                scrollable
                showViewOptions
                subgroupBy={(activity) =>
                  activity.containerType === "project"
                    ? (activity.projectStageId ?? "without-project-stage")
                    : null
                }
                toolbar={activityFilters}
                onColumnVisibilityChange={setColumnVisibility}
              />
            </DndContext>
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
  hasFilters,
  onChange,
  priority,
  query,
  status,
}: Readonly<{
  activityCategoryId: string;
  assignedUserId: string;
  categories: readonly ActivityCategory[];
  clientId: string;
  containerType: "all" | Activity["containerType"];
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

function ActivityTreeCell({
  activity,
  canManage,
  children,
  depth,
  dropPlacements,
}: Readonly<{
  activity: Activity;
  canManage: boolean;
  children: ReactNode;
  depth: number;
  dropPlacements: readonly Exclude<ActivityRelocationPlacement, "last">[];
}>) {
  const draggable = useDraggable({ disabled: !canManage, id: activity.id });

  return (
    <div className="relative flex min-w-72 items-center gap-2" style={{ paddingLeft: depth * 20 }}>
      {canManage ? (
        <button
          aria-label={`Arrastrar ${activity.name}`}
          className="cursor-grab text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          ref={draggable.setNodeRef}
          type="button"
          {...draggable.attributes}
          {...draggable.listeners}
        >
          <Icons.gripVertical />
        </button>
      ) : null}
      {children}
      {dropPlacements.length ? (
        <span className="ml-auto flex gap-1" aria-label={`Destinos para ${activity.name}`}>
          {dropPlacements.map((placement) => (
            <DropTarget
              id={`${activity.id}|${placement}`}
              key={placement}
              label={dropPlacementLabels[placement]}
            />
          ))}
        </span>
      ) : null}
    </div>
  );
}

function DropTarget({ id, label }: Readonly<{ id: string; label: string }>) {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <span
      className={
        isOver
          ? "rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground"
          : "rounded border px-1.5 py-0.5 text-xs text-muted-foreground"
      }
      ref={setNodeRef}
    >
      {label}
    </span>
  );
}

function ActivityContainerBand({
  activity,
  activeDragActivity,
}: Readonly<{ activity: Activity; activeDragActivity: Activity | null }>) {
  return (
    <div className="flex min-w-max items-center gap-2 text-sm">
      <span className="font-semibold text-info">
        {containerLabels[activity.containerType]}: {activity.containerName}
      </span>
      <span className="text-muted-foreground">{activity.clientName}</span>
      {activeDragActivity?.containerId === activity.containerId ? (
        <span className="ml-2">
          <DropTarget id={`${activity.containerId}|last`} label="Como raíz al final" />
        </span>
      ) : null}
    </div>
  );
}

function ActivityProjectStageBand({ activity }: Readonly<{ activity: Activity }>) {
  return (
    <div className="flex min-w-max items-center gap-2 pl-1 text-sm">
      <span className="font-medium text-info">Etapa</span>
      <span className="text-foreground">{activity.projectStageName ?? "Sin etapa"}</span>
    </div>
  );
}

function createColumns({
  canManage,
  categoryNames,
  expandedActivityIds,
  activeDragActivity,
  getDropPlacements,
  onDelete,
  onEdit,
  onMoveToRoot,
  onToggleExpanded,
  treeMeta,
  onView,
}: Readonly<{
  canManage: boolean;
  categoryNames: ReadonlyMap<string, string>;
  expandedActivityIds: ReadonlySet<string>;
  activeDragActivity: Activity | null;
  getDropPlacements: (target: Activity) => readonly Exclude<ActivityRelocationPlacement, "last">[];
  onDelete: (activity: Activity) => void;
  onEdit: (activity: Activity) => void;
  onMoveToRoot: (activity: Activity) => void;
  onToggleExpanded: (activityId: string) => void;
  treeMeta: ReadonlyMap<string, ActivityTreeMetadata>;
  onView: (activity: Activity) => void;
}>): DataTableColumn<Activity>[] {
  return [
    {
      cell: (activity) => {
        const metadata = treeMeta.get(activity.id) ?? {
          childCount: 0,
          depth: 0,
          subtreeHeight: 0,
        };
        const isExpanded = expandedActivityIds.has(activity.id);
        return (
          <ActivityTreeCell
            activity={activity}
            canManage={canManage}
            depth={metadata.depth}
            dropPlacements={
              activeDragActivity && activeDragActivity.id !== activity.id
                ? getDropPlacements(activity)
                : []
            }
          >
            {metadata.childCount ? (
              <button
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Contraer" : "Expandir"} ${activity.name}`}
                className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => onToggleExpanded(activity.id)}
                type="button"
              >
                {isExpanded ? <Icons.chevronDown /> : <Icons.chevronRight />}
              </button>
            ) : (
              <span aria-hidden className="size-6 shrink-0" />
            )}
            <span className="font-semibold text-foreground">{activity.name}</span>
            {"matchesFilter" in activity && !activity.matchesFilter ? (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                Contexto
              </span>
            ) : null}
          </ActivityTreeCell>
        );
      },
      header: "Actividad",
      hideable: true,
      id: "name",
    },
    {
      cell: (activity) => (
        <StatusBadge label={statusLabels[activity.status]} tone={statusTones[activity.status]} />
      ),
      header: "Estado",
      hideable: true,
      id: "status",
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
        <span className="block max-w-40 truncate text-sm">{activity.assignedUserName}</span>
      ),
      header: "Responsable",
      hideable: true,
      id: "assignee",
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
    },
    {
      cell: (activity) => <span className="tabular-nums">{activity.estimatedHours} h</span>,
      header: "Estimación",
      hideable: true,
      id: "estimate",
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
                {activity.parentActivityId ? (
                  <DropdownMenuItem onSelect={() => onMoveToRoot(activity)}>
                    <Icons.gripVertical />
                    Convertir en última raíz
                  </DropdownMenuItem>
                ) : null}
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
      cellClassName: "w-10 max-w-10 min-w-10 px-1",
      header: "Acciones",
      headerClassName: "sr-only w-10 max-w-10 min-w-10 px-1",
      id: "actions",
      maxSize: 48,
      minSize: 48,
      size: 48,
    },
  ];
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00.000Z`),
  );
}

function treeMetadata(
  activities: readonly ActivityTreeItem[],
): ReadonlyMap<string, ActivityTreeMetadata> {
  const childrenByParent = new Map<string | null, ActivityTreeItem[]>();
  for (const activity of activities) {
    const children = childrenByParent.get(activity.parentActivityId) ?? [];
    children.push(activity);
    childrenByParent.set(activity.parentActivityId, children);
  }
  const metadata = new Map<string, ActivityTreeMetadata>();
  const visit = (activity: ActivityTreeItem, depth: number): number => {
    const children = childrenByParent.get(activity.id) ?? [];
    const subtreeHeight = children.reduce(
      (height, child) => Math.max(height, visit(child, depth + 1) + 1),
      0,
    );
    metadata.set(activity.id, { childCount: children.length, depth, subtreeHeight });
    return subtreeHeight;
  };
  (childrenByParent.get(null) ?? []).forEach((activity) => visit(activity, 0));
  return metadata;
}

function getValidDropPlacements(
  source: Activity,
  target: Activity,
  treeMeta: ReadonlyMap<string, ActivityTreeMetadata>,
  activitiesById: ReadonlyMap<string, ActivityTreeItem>,
): readonly Exclude<ActivityRelocationPlacement, "last">[] {
  return (["before", "inside", "after"] as const).filter((placement) =>
    isValidDropTarget(source, target, placement, treeMeta, activitiesById),
  );
}

function isValidDropTarget(
  source: Activity,
  target: Activity,
  placement: Exclude<ActivityRelocationPlacement, "last">,
  treeMeta: ReadonlyMap<string, ActivityTreeMetadata>,
  activitiesById: ReadonlyMap<string, ActivityTreeItem>,
): boolean {
  if (
    source.id === target.id ||
    source.containerId !== target.containerId ||
    source.projectStageId !== target.projectStageId ||
    isDescendantOf(target, source.id, activitiesById)
  ) {
    return false;
  }
  const sourceHeight = treeMeta.get(source.id)?.subtreeHeight ?? 0;
  const targetDepth = treeMeta.get(target.id)?.depth ?? 0;
  return placement === "inside" ? targetDepth + sourceHeight < 3 : targetDepth + sourceHeight <= 3;
}

function isDescendantOf(
  activity: Activity,
  ancestorId: string,
  activitiesById: ReadonlyMap<string, ActivityTreeItem>,
): boolean {
  let parentId = activity.parentActivityId;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = activitiesById.get(parentId)?.parentActivityId ?? null;
  }
  return false;
}

function dropTargetAnnouncement(
  targetId: string,
  activitiesById: ReadonlyMap<string, ActivityTreeItem>,
): string {
  const [id, placement] = targetId.split("|");
  if (placement === "last") return "como última Actividad raíz";
  const target = activitiesById.get(id);
  return `${dropPlacementLabels[placement as Exclude<ActivityRelocationPlacement, "last">] ?? "junto a"} ${target?.name ?? "la Actividad"}`;
}

function visibleTreeActivities(
  activities: readonly ActivityTreeItem[],
  expandedActivityIds: ReadonlySet<string>,
  revealMatches: boolean,
): readonly ActivityTreeItem[] {
  const childrenByParent = new Map<string | null, ActivityTreeItem[]>();
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const expanded = new Set(expandedActivityIds);
  if (revealMatches) {
    for (const activity of activities.filter((item) => item.matchesFilter)) {
      let parentId = activity.parentActivityId;
      while (parentId) {
        expanded.add(parentId);
        parentId = byId.get(parentId)?.parentActivityId ?? null;
      }
    }
  }
  for (const activity of activities) {
    const children = childrenByParent.get(activity.parentActivityId) ?? [];
    children.push(activity);
    childrenByParent.set(activity.parentActivityId, children);
  }
  const visible: ActivityTreeItem[] = [];
  const visit = (activity: ActivityTreeItem) => {
    visible.push(activity);
    if (expanded.has(activity.id)) (childrenByParent.get(activity.id) ?? []).forEach(visit);
  };
  (childrenByParent.get(null) ?? []).forEach(visit);
  return visible;
}

function groupActivitiesByContainer(
  activities: readonly ActivityTreeItem[],
): readonly ActivityTreeItem[] {
  const activitiesByContainer = new Map<string, Map<string, ActivityTreeItem[]>>();
  for (const activity of activities) {
    const activitiesByStage = activitiesByContainer.get(activity.containerId) ?? new Map();
    const stageKey =
      activity.containerType === "project"
        ? (activity.projectStageId ?? "without-project-stage")
        : "container-activities";
    const stageActivities = activitiesByStage.get(stageKey) ?? [];
    stageActivities.push(activity);
    activitiesByStage.set(stageKey, stageActivities);
    activitiesByContainer.set(activity.containerId, activitiesByStage);
  }
  return [...activitiesByContainer.values()].flatMap((activitiesByStage) =>
    [...activitiesByStage.values()].flat(),
  );
}

const containerLabels: Record<Activity["containerType"], string> = {
  project: "Proyecto",
  requirement: "Requerimiento",
  ticket: "Ticket",
};
