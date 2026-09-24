"use client";

import { useEffect, useState } from "react";

import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../../../components/ui/sheet";
import {
  activityPriorities,
  activityStatuses,
  createActivityDependency,
  deleteActivityDependency,
  createActivity,
  getActivity,
  listActivities,
  listActivityAuditEvents,
  updateActivity,
  type Activity,
  type ActivityAuditEvent,
  type ActivityDetail as ActivityDetailData,
  type ActivityDependency,
  type ActivityPriority,
  type ActivityStatus,
} from "../../../lib/activities-client";
import { getProject, type ProjectStage } from "../../../lib/projects-client";
import {
  listActivityCategories,
  type ActivityCategory,
} from "../../../lib/activity-categories-client";
import {
  ActivityPredecessorSearchField,
  AssigneeSearchField,
  ContainerSearchField,
  ProjectStageSearchField,
} from "./activity-search-fields";
import {
  ActivityDescriptionContent,
  ActivityDescriptionEditor,
} from "./activity-description-editor";
import {
  validateActivityForm,
  type ActivityFormErrors,
  type ActivityFormValues,
} from "./activity-form-validation";

export type ActivitySheetMode = "create" | "edit" | "view";

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
const containerLabels: Record<Activity["containerType"], string> = {
  project: "Proyecto",
  requirement: "Requerimiento",
  ticket: "Ticket",
};

const emptyForm = (): ActivityFormValues => ({
  activityCategoryId: "",
  assignedUserId: "",
  blockedReason: "",
  containerId: "",
  containerType: "project",
  customerCommitmentDate: "",
  description: null,
  estimatedHours: "",
  isCustomerDeliverable: false,
  name: "",
  parentActivityId: "",
  priority: "medium",
  projectStageId: "",
  status: "pending",
  targetDate: "",
  waitingFor: "",
  waitingReason: "",
});

function activityForm(activity: Activity | null): ActivityFormValues {
  if (!activity) return emptyForm();
  return {
    activityCategoryId: activity.activityCategoryId,
    assignedUserId: activity.assignedUserId,
    blockedReason: activity.blockedReason ?? "",
    containerId: activity.containerId,
    containerType: activity.containerType,
    customerCommitmentDate: activity.customerCommitmentDate ?? "",
    description: activity.description,
    estimatedHours: String(activity.estimatedHours),
    isCustomerDeliverable: activity.isCustomerDeliverable,
    name: activity.name,
    parentActivityId: activity.parentActivityId ?? "",
    priority: activity.priority,
    projectStageId: activity.projectStageId ?? "",
    status: activity.status,
    targetDate: activity.targetDate ?? "",
    waitingFor: activity.waitingFor ?? "",
    waitingReason: activity.waitingReason ?? "",
  };
}

export function ActivitySheet({
  activity,
  canManage,
  mode,
  onOpenChange,
  onSaved,
  open,
}: Readonly<{
  activity: Activity | null;
  canManage: boolean;
  mode: ActivitySheetMode;
  onOpenChange: (open: boolean) => void;
  onSaved: (activity: Activity, created: boolean) => void;
  open: boolean;
}>) {
  const isCreate = mode === "create";
  const isView = mode === "view";
  const [auditEvents, setAuditEvents] = useState<readonly ActivityAuditEvent[]>([]);
  const [detailActivity, setDetailActivity] = useState<ActivityDetailData | null>(null);
  const [categories, setCategories] = useState<readonly ActivityCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ActivityFormErrors>({});
  const [form, setForm] = useState<ActivityFormValues>(emptyForm);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projectStages, setProjectStages] = useState<readonly ProjectStage[]>([]);
  const [selectedPredecessors, setSelectedPredecessors] = useState<readonly Activity[]>([]);

  useEffect(() => {
    if (!open) return;
    setAuditEvents([]);
    setDetailActivity(null);
    setSelectedPredecessors([]);
    setError(null);
    setFieldErrors({});
    setForm(activityForm(activity));
    setIsSaving(false);
    void listActivityCategories().then((result) => {
      if (result.kind === "success") setCategories(result.data);
    });
    if (activity && !isCreate) {
      setIsLoadingDetail(true);
      void getActivity(activity.id).then((result) => {
        if (result.kind === "success") setDetailActivity(result.data);
        else if (result.kind !== "unauthorized") setError(result.message);
        setIsLoadingDetail(false);
      });
      setIsLoadingTimeline(true);
      void listActivityAuditEvents(activity.id).then((result) => {
        if (result.kind === "success") setAuditEvents(result.data);
        else if (result.kind !== "unauthorized") setError(result.message);
        setIsLoadingTimeline(false);
      });
    }
  }, [activity, isView, open]);

  useEffect(() => {
    if (!open || !isCreate || form.containerType !== "project" || !form.containerId) {
      setProjectStages([]);
      return;
    }
    let current = true;
    void getProject(form.containerId).then((result) => {
      if (!current) return;
      if (result.kind === "success") setProjectStages(result.data.stages);
      else if (result.kind !== "unauthorized") setError(result.message);
    });
    return () => {
      current = false;
    };
  }, [form.containerId, form.containerType, isCreate, open]);

  const setValue = <Key extends keyof ActivityFormValues>(
    key: Key,
    value: ActivityFormValues[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  };
  async function save() {
    const validation = validateActivityForm(form, isCreate);
    if (Object.keys(validation).length) {
      setFieldErrors(validation);
      setError("Revisa los campos marcados antes de continuar.");
      return;
    }
    setError(null);
    setFieldErrors({});
    setIsSaving(true);
    const payload = toPayload(form);
    const result = isCreate
      ? await createActivity(payload)
      : await updateActivity(activity?.id ?? "", {
          ...payload,
          version: detailActivity?.version ?? activity?.version ?? 0,
        });
    setIsSaving(false);
    if (result.kind !== "success") {
      setError(
        result.kind === "unauthorized"
          ? "Tu sesión no permite gestionar Actividades."
          : result.message,
      );
      return;
    }
    if (isCreate && selectedPredecessors.length) {
      let current = result.data;
      for (const predecessor of selectedPredecessors) {
        const dependency = await createActivityDependency(current.id, {
          predecessorActivityId: predecessor.id,
          version: current.version,
        });
        if (dependency.kind !== "success") {
          setError(
            dependency.kind === "unauthorized"
              ? "La Actividad fue creada, pero no puedes vincular sus predecesoras."
              : `La Actividad fue creada, pero no se vinculó ${predecessor.name}: ${dependency.message}`,
          );
          return;
        }
        const refreshed = await getActivity(current.id);
        if (refreshed.kind !== "success") {
          setError("La Actividad fue creada, pero no se pudo actualizar sus dependencias.");
          return;
        }
        current = refreshed.data;
      }
      onSaved(current, true);
    } else onSaved(result.data, isCreate);
    onOpenChange(false);
  }
  const title = isCreate ? "Nueva Actividad" : isView ? "Detalle de Actividad" : "Editar Actividad";
  return (
    <Sheet onOpenChange={(next) => !isSaving && onOpenChange(next)} open={open}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-3xl" side="right">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-12">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {isCreate
              ? "Define dónde ocurre el trabajo y cómo se hará seguimiento."
              : "La ubicación se conserva para proteger el contexto operativo."}
          </SheetDescription>
        </SheetHeader>
        {isView && activity ? (
          <ActivityDetail
            activity={detailActivity ?? activity}
            auditEvents={auditEvents}
            canManage={canManage}
            detailActivity={detailActivity}
            isLoadingDetail={isLoadingDetail}
            onDetailChanged={setDetailActivity}
            categories={categories}
            isLoadingTimeline={isLoadingTimeline}
          />
        ) : (
          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
              <section>
                <SectionTitle
                  title="Ubicación"
                  description="El contenedor no se puede cambiar después de crear."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {isCreate ? (
                    <>
                      <LabeledSelect
                        label="Tipo de contenedor"
                        value={form.containerType}
                        onChange={(value) =>
                          setForm((current) => ({
                            ...current,
                            containerId: "",
                            containerType: value as Activity["containerType"],
                            projectStageId: "",
                          }))
                        }
                      >
                        <option value="project">Proyecto</option>
                        <option value="requirement">Requerimiento</option>
                        <option value="ticket">Ticket</option>
                      </LabeledSelect>
                      <ContainerSearchField
                        containerType={form.containerType}
                        error={fieldErrors.containerId}
                        onSelected={(containerId) => {
                          setForm((current) => ({ ...current, containerId, projectStageId: "" }));
                          setFieldErrors((current) => ({
                            ...current,
                            containerId: undefined,
                            projectStageId: undefined,
                          }));
                        }}
                        selectedId={form.containerId}
                      />
                    </>
                  ) : (
                    <ReadOnlyField
                      label="Contenedor"
                      value={activity?.containerName ?? form.containerId}
                    />
                  )}{" "}
                  {isCreate && form.containerType === "project" && form.containerId ? (
                    <ProjectStageSearchField
                      error={fieldErrors.projectStageId}
                      onSelected={(projectStageId) => setValue("projectStageId", projectStageId)}
                      selectedId={form.projectStageId}
                      stages={projectStages}
                    />
                  ) : form.containerType === "project" ? (
                    <ReadOnlyField
                      label="Etapa"
                      value={activity?.projectStageName ?? "Sin etapa"}
                    />
                  ) : null}
                  <LabeledInput
                    label="ID de actividad padre"
                    value={form.parentActivityId}
                    onChange={(value) => setValue("parentActivityId", value)}
                    help="Opcional. Debe pertenecer al mismo contenedor."
                  />
                </div>
              </section>
              <section>
                <SectionTitle
                  title="Planificación"
                  description="Define el resultado, el responsable y el horizonte de entrega."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <LabeledInput
                      label="Nombre"
                      error={fieldErrors.name}
                      required
                      maxLength={200}
                      value={form.name}
                      onChange={(value) => setValue("name", value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <div className="grid gap-2 text-sm font-medium text-foreground">
                      <p>Descripción</p>
                      <ActivityDescriptionEditor
                        value={form.description}
                        onChange={(value) => setValue("description", value)}
                      />
                    </div>
                  </div>
                  <LabeledSelect
                    label="Categoría"
                    error={fieldErrors.activityCategoryId}
                    required
                    value={form.activityCategoryId}
                    onChange={(value) => setValue("activityCategoryId", value)}
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </LabeledSelect>
                  <AssigneeSearchField
                    error={fieldErrors.assignedUserId}
                    onSelected={(assignedUserId) => setValue("assignedUserId", assignedUserId)}
                    selectedId={form.assignedUserId}
                    selectedLabel={activity?.assignedUserName}
                  />
                  <LabeledSelect
                    label="Prioridad"
                    value={form.priority}
                    onChange={(value) => setValue("priority", value as ActivityPriority)}
                  >
                    {activityPriorities.map((value) => (
                      <option key={value} value={value}>
                        {priorityLabels[value]}
                      </option>
                    ))}
                  </LabeledSelect>
                  <LabeledInput
                    label="Estimación (horas)"
                    error={fieldErrors.estimatedHours}
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                    value={form.estimatedHours}
                    onChange={(value) => setValue("estimatedHours", value)}
                  />
                  <LabeledInput
                    label="Fecha objetivo"
                    type="date"
                    value={form.targetDate}
                    onChange={(value) => setValue("targetDate", value)}
                  />
                  <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.isCustomerDeliverable}
                      onCheckedChange={(checked) =>
                        setValue("isCustomerDeliverable", checked === true)
                      }
                    />
                    Entregable para cliente
                  </label>
                  {form.isCustomerDeliverable ? (
                    <LabeledInput
                      label="Fecha de compromiso"
                      error={fieldErrors.customerCommitmentDate}
                      required
                      type="date"
                      value={form.customerCommitmentDate}
                      onChange={(value) => setValue("customerCommitmentDate", value)}
                    />
                  ) : null}
                </div>
              </section>
              <section>
                <SectionTitle
                  title="Seguimiento"
                  description="La información específica aparece solo mientras el estado la requiere."
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <LabeledSelect
                    label="Estado"
                    value={form.status}
                    onChange={(value) => setValue("status", value as ActivityStatus)}
                  >
                    {activityStatuses.map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </LabeledSelect>
                  {detailActivity && pendingPredecessors(detailActivity).length ? (
                    <div className="sm:col-span-2">
                      <PendingDependenciesWarning
                        emphasized={form.status === "finalized"}
                        predecessors={pendingPredecessors(detailActivity)}
                      />
                    </div>
                  ) : null}
                  {form.status === "blocked" ? (
                    <div className="sm:col-span-2">
                      <LabeledTextarea
                        label="Motivo del bloqueo"
                        error={fieldErrors.blockedReason}
                        required
                        maxLength={2000}
                        value={form.blockedReason}
                        onChange={(value) => setValue("blockedReason", value)}
                      />
                    </div>
                  ) : null}
                  {form.status === "waiting_third_party" ? (
                    <>
                      <LabeledSelect
                        label="Esperando a"
                        error={fieldErrors.waitingFor}
                        required
                        value={form.waitingFor}
                        onChange={(value) =>
                          setValue("waitingFor", value as ActivityFormValues["waitingFor"])
                        }
                      >
                        <option value="">Selecciona una opción</option>
                        <option value="client">Cliente</option>
                        <option value="provider">Proveedor</option>
                        <option value="other">Otro</option>
                      </LabeledSelect>
                      <div className="sm:col-span-2">
                        <LabeledTextarea
                          label="Motivo de espera"
                          error={fieldErrors.waitingReason}
                          required
                          maxLength={2000}
                          value={form.waitingReason}
                          onChange={(value) => setValue("waitingReason", value)}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              </section>
              {isCreate ? (
                <CreateDependenciesSelector
                  containerId={form.containerId}
                  containerType={form.containerType}
                  onChange={setSelectedPredecessors}
                  selected={selectedPredecessors}
                />
              ) : detailActivity ? (
                <DependenciesSection
                  activity={detailActivity}
                  canManage={canManage}
                  isLoading={isLoadingDetail}
                  onChanged={setDetailActivity}
                />
              ) : null}
              {error ? (
                <div
                  className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger"
                  role="alert"
                >
                  <p>{error}</p>
                  {Object.keys(fieldErrors).length ? (
                    <ul className="mt-1 list-disc pl-5">
                      {Object.entries(fieldErrors).map(([field, message]) => (
                        <li key={field}>{message}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
            <SheetFooter className="shrink-0 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                disabled={isSaving}
                onClick={() => onOpenChange(false)}
                type="button"
                variant="cancel"
              >
                Cancelar
              </Button>
              <Button disabled={isSaving || !canManage} type="submit">
                {isSaving ? "Guardando…" : isCreate ? "Crear Actividad" : "Guardar cambios"}
              </Button>
            </SheetFooter>
          </form>
        )}
        {isView ? (
          <SheetFooter className="shrink-0 border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
            <Button onClick={() => onOpenChange(false)} type="button" variant="cancel">
              Cerrar
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ActivityDetail({
  activity,
  auditEvents,
  canManage,
  categories,
  detailActivity,
  isLoadingDetail,
  onDetailChanged,
  isLoadingTimeline,
}: Readonly<{
  activity: Activity;
  auditEvents: readonly ActivityAuditEvent[];
  canManage: boolean;
  categories: readonly ActivityCategory[];
  detailActivity: ActivityDetailData | null;
  isLoadingDetail: boolean;
  onDetailChanged: (activity: ActivityDetailData) => void;
  isLoadingTimeline: boolean;
}>) {
  const category =
    categories.find((item) => item.id === activity.activityCategoryId)?.name ??
    "Categoría histórica";
  return (
    <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-6">
      <section className="rounded-lg border border-border bg-muted/30 p-5">
        <p className="text-sm font-medium text-muted-foreground">
          {containerLabels[activity.containerType]}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-foreground">{activity.name}</h2>
        <dl className="mt-5 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
          <Detail label="Categoría" value={category} />
          <Detail label="Estado" value={statusLabels[activity.status]} />
          <Detail label="Prioridad" value={priorityLabels[activity.priority]} />
          <Detail label="Estimación" value={`${activity.estimatedHours} horas`} />
          <Detail label="Responsable" value={activity.assignedUserName} />
          <Detail label="Fecha objetivo" value={activity.targetDate ?? "Sin fecha"} />
          <Detail label="Contenedor" value={activity.containerName} />
          <Detail label="Etapa" value={activity.projectStageName ?? "No aplica"} />
          <Detail label="Descripción" wide>
            <ActivityDescriptionContent value={activity.description} />
          </Detail>
        </dl>
      </section>
      {pendingPredecessors(detailActivity).length ? (
        <PendingDependenciesWarning
          emphasized={activity.status === "finalized"}
          predecessors={pendingPredecessors(detailActivity)}
        />
      ) : null}
      <DependenciesSection
        activity={detailActivity}
        canManage={canManage}
        isLoading={isLoadingDetail}
        onChanged={onDetailChanged}
      />
      <section>
        <SectionTitle
          title="Línea de tiempo"
          description="Cambios registrados para esta Actividad."
        />
        {isLoadingTimeline ? (
          <p className="mt-4 text-sm text-muted-foreground">Cargando historial…</p>
        ) : auditEvents.length ? (
          <ol className="mt-4 space-y-4 border-l border-border pl-5">
            {auditEvents.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute -left-[1.78rem] top-1.5 size-2.5 rounded-full bg-primary" />
                <p className="text-sm font-medium text-foreground">{eventLabels[event.action]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(event.occurredAt))}{" "}
                  · {event.actorUserName}
                </p>
                <ChangeSummary activity={activity} event={event} />
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Aún no hay eventos disponibles.</p>
        )}
      </section>
    </div>
  );
}

function CreateDependenciesSelector({
  containerId,
  containerType,
  onChange,
  selected,
}: Readonly<{
  containerId: string;
  containerType: Activity["containerType"];
  onChange: (activities: readonly Activity[]) => void;
  selected: readonly Activity[];
}>) {
  const [candidates, setCandidates] = useState<readonly Activity[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!containerId) {
      setCandidates([]);
      setIsSearching(false);
      return;
    }
    let current = true;
    setIsSearching(true);
    const timeout = window.setTimeout(async () => {
      const result = await listActivities({ containerId, containerType, query });
      if (current && result.kind === "success") {
        const selectedIds = new Set(selected.map((item) => item.id));
        setCandidates(result.data.activities.filter((item) => !selectedIds.has(item.id)));
      }
      if (current) setIsSearching(false);
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [containerId, containerType, query, selected]);
  return (
    <section>
      <SectionTitle
        title="Dependencias"
        description="Selecciona Actividades que deben realizarse antes."
      />
      {!containerId ? (
        <p className="mt-4 text-sm text-muted-foreground">Selecciona primero un contenedor.</p>
      ) : (
        <div className="mt-4">
          <ActivityPredecessorSearchField
            activities={candidates}
            disabled={false}
            emptyMessage="No hay Actividades disponibles para agregar."
            isLoading={isSearching}
            onQueryChange={setQuery}
            onSelected={(candidate) => onChange([...selected, candidate])}
          />
        </div>
      )}
      {selected.length ? (
        <ul className="mt-3 space-y-2">
          {selected.map((item) => (
            <li
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              key={item.id}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              <Button
                onClick={() =>
                  onChange(selected.filter((selectedItem) => selectedItem.id !== item.id))
                }
                size="sm"
                type="button"
                variant="ghost"
              >
                Quitar
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function pendingPredecessors(activity: ActivityDetailData | null): readonly ActivityDependency[] {
  return (
    activity?.dependencies.predecessors.filter(
      (predecessor) => predecessor.status !== "finalized",
    ) ?? []
  );
}
function PendingDependenciesWarning({
  emphasized,
  predecessors,
}: Readonly<{ emphasized: boolean; predecessors: readonly ActivityDependency[] }>) {
  return (
    <div
      className={
        emphasized
          ? "rounded-md border border-warning/50 bg-warning/10 px-3 py-3 text-sm text-foreground"
          : "rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground"
      }
      role="status"
    >
      <p className="font-medium">Hay actividades previas pendientes.</p>
      <p className="mt-1 text-muted-foreground">
        {emphasized
          ? "Puedes finalizar esta Actividad si existe una excepción operativa."
          : "Completa estas Actividades antes cuando sea posible."}
      </p>
      <ul className="mt-2 list-disc pl-5 text-muted-foreground">
        {predecessors.map((predecessor) => (
          <li key={predecessor.id}>{predecessor.name}</li>
        ))}
      </ul>
    </div>
  );
}

function DependenciesSection({
  activity,
  canManage,
  isLoading,
  onChanged,
}: Readonly<{
  activity: ActivityDetailData | null;
  canManage: boolean;
  isLoading: boolean;
  onChanged: (activity: ActivityDetailData) => void;
}>) {
  const [candidates, setCandidates] = useState<readonly Activity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!activity || !canManage) return;
    let current = true;
    setIsSearching(true);
    const timeout = window.setTimeout(async () => {
      const result = await listActivities({
        containerId: activity.containerId,
        containerType: activity.containerType,
        query,
      });
      if (!current) return;
      if (result.kind === "success") {
        const predecessorIds = new Set(activity.dependencies.predecessors.map((item) => item.id));
        setCandidates(
          result.data.activities.filter(
            (item) => item.id !== activity.id && !predecessorIds.has(item.id),
          ),
        );
      } else if (result.kind !== "unauthorized") setError(result.message);
      setIsSearching(false);
    }, 200);
    return () => {
      current = false;
      window.clearTimeout(timeout);
    };
  }, [activity, canManage, query]);
  async function refresh() {
    if (!activity) return;
    const result = await getActivity(activity.id);
    if (result.kind === "success") onChanged(result.data);
    else if (result.kind !== "unauthorized") setError(result.message);
  }
  async function add(predecessorActivityId: string) {
    if (!activity) return;
    setError(null);
    setIsSaving(true);
    const result = await createActivityDependency(activity.id, {
      predecessorActivityId,
      version: activity.version,
    });
    if (result.kind === "success") await refresh();
    else
      setError(
        result.kind === "unauthorized" ? "No puedes gestionar dependencias." : result.message,
      );
    setIsSaving(false);
  }
  async function remove(predecessor: ActivityDependency) {
    if (!activity) return;
    setError(null);
    setIsSaving(true);
    const result = await deleteActivityDependency(activity.id, predecessor.id, activity.version);
    if (result.kind === "success") await refresh();
    else
      setError(
        result.kind === "unauthorized" ? "No puedes gestionar dependencias." : result.message,
      );
    setIsSaving(false);
  }
  return (
    <section>
      <SectionTitle
        title="Dependencias"
        description="Indican qué Actividades deben realizarse antes."
      />
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando dependencias…</p>
      ) : null}
      {!isLoading && !activity ? (
        <p className="mt-4 text-sm text-muted-foreground">No hay dependencias disponibles.</p>
      ) : null}
      {activity ? (
        <div className="mt-4 space-y-4">
          <DependencyList
            emptyMessage="No tiene Actividades predecesoras."
            items={activity.dependencies.predecessors}
            label="Predecesoras"
            onRemove={canManage ? remove : undefined}
            saving={isSaving}
          />
          <DependencyList
            emptyMessage="No tiene Actividades sucesoras."
            items={activity.dependencies.successors}
            label="Sucesoras"
            saving={false}
          />
          {canManage ? (
            <div className="border-t border-border pt-4">
              <ActivityPredecessorSearchField
                activities={candidates}
                disabled={isSaving}
                emptyMessage="No hay Actividades disponibles para agregar."
                isLoading={isSearching}
                onQueryChange={setQuery}
                onSelected={(candidate) => void add(candidate.id)}
              />
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
function DependencyList({
  emptyMessage,
  items,
  label,
  onRemove,
  saving,
}: Readonly<{
  emptyMessage: string;
  items: readonly ActivityDependency[];
  label: string;
  onRemove?: (item: ActivityDependency) => void;
  saving: boolean;
}>) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">{label}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
              key={item.id}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
              <span className="text-xs text-muted-foreground">{statusLabels[item.status]}</span>
              {onRemove ? (
                <Button
                  disabled={saving}
                  onClick={() => void onRemove(item)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Quitar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );
}

function ChangeSummary({
  activity,
  event,
}: Readonly<{ activity: Activity; event: ActivityAuditEvent }>) {
  if (event.action === "create") {
    return (
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <p>
          En <span className="font-medium text-foreground">{activity.containerName}</span>
          {activity.projectStageName ? ` · ${activity.projectStageName}` : ""}.
        </p>
        <p>
          Responsable:{" "}
          <span className="font-medium text-foreground">{activity.assignedUserName}</span>
          {` · ${statusLabels[activity.status]} · ${priorityLabels[activity.priority]} · ${activity.estimatedHours} h`}
          .
        </p>
      </div>
    );
  }
  if (event.action === "delete")
    return <p className="mt-1 text-sm text-muted-foreground">La Actividad fue eliminada.</p>;

  const changes = readableChanges(event.changes);
  return changes.length ? (
    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
      {changes.map((change) => (
        <li key={change.label}>
          <span className="font-medium text-foreground">{change.label}:</span> {change.before} →{" "}
          {change.after}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-1 text-sm text-muted-foreground">Se actualizó la Actividad.</p>
  );
}

const auditFieldLabels: Record<string, string> = {
  activityCategoryId: "Categoría",
  assignedUserName: "Responsable",
  blockedReason: "Motivo del bloqueo",
  customerCommitmentDate: "Fecha de compromiso",
  description: "Descripción",
  estimatedHours: "Estimación",
  isCustomerDeliverable: "Entregable para cliente",
  name: "Nombre",
  parentActivityId: "Actividad padre",
  priority: "Prioridad",
  projectStageName: "Etapa",
  status: "Estado",
  targetDate: "Fecha objetivo",
  waitingFor: "Esperando a",
  waitingReason: "Motivo de espera",
};

function readableChanges(changes: Record<string, unknown>) {
  return Object.entries(changes)
    .filter(([key]) => key in auditFieldLabels)
    .map(([key, value]) => {
      const change = readAuditChange(value);
      return change
        ? {
            after: formatAuditValue(key, change.after),
            before: formatAuditValue(key, change.before),
            label: auditFieldLabels[key] ?? key,
          }
        : null;
    })
    .filter(
      (change): change is { after: string; before: string; label: string } => change !== null,
    );
}

function readAuditChange(value: unknown): { after: unknown; before: unknown } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const change = value as Record<string, unknown>;
  return "after" in change && "before" in change
    ? { after: change.after, before: change.before }
    : null;
}

function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === "") return "Sin valor";
  if (key === "status" && typeof value === "string")
    return statusLabels[value as ActivityStatus] ?? value;
  if (key === "priority" && typeof value === "string")
    return priorityLabels[value as ActivityPriority] ?? value;
  if (key === "waitingFor")
    return value === "client" ? "Cliente" : value === "provider" ? "Proveedor" : "Otro";
  if (key === "isCustomerDeliverable") return value === true ? "Sí" : "No";
  if (key === "estimatedHours") return `${value} h`;
  if (key === "activityCategoryId" || key === "parentActivityId") return "Actualizada";
  return typeof value === "string" || typeof value === "number" ? String(value) : "Actualizado";
}
function Detail({
  children,
  label,
  value,
  wide = false,
}: Readonly<{ children?: React.ReactNode; label: string; value?: string; wide?: boolean }>) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap text-foreground">{children ?? value}</dd>
    </div>
  );
}
function SectionTitle({ title, description }: Readonly<{ title: string; description: string }>) {
  return (
    <div>
      <h2 className="font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
function LabeledInput({
  error,
  help,
  label,
  onChange,
  ...props
}: Readonly<
  { error?: string; help?: string; label: string; onChange: (value: string) => void } & Omit<
    React.ComponentProps<typeof Input>,
    "onChange"
  >
>) {
  const id = `activity-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={id}>
      {label}
      <Input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      {error ? (
        <span className="text-xs font-normal text-danger" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
      {help ? <span className="text-xs font-normal text-muted-foreground">{help}</span> : null}
    </label>
  );
}
function LabeledTextarea({
  error,
  label,
  onChange,
  ...props
}: Readonly<
  { error?: string; label: string; onChange: (value: string) => void } & Omit<
    React.ComponentProps<typeof Textarea>,
    "onChange"
  >
>) {
  const id = `activity-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={id}>
      {label}
      <Textarea
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
      {error ? (
        <span className="text-xs font-normal text-danger" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
function LabeledSelect({
  children,
  error,
  label,
  onChange,
  required,
  value,
}: Readonly<{
  children: React.ReactNode;
  error?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}>) {
  const id = `activity-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <label className="grid gap-2 text-sm font-medium text-foreground" htmlFor={id}>
      {label}
      {required ? " *" : null}
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs"
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        {children}
      </select>
      {error ? (
        <span className="text-xs font-normal text-danger" id={`${id}-error`}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
function ReadOnlyField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm sm:col-span-2">
      <p className="font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-all text-foreground">{value}</p>
    </div>
  );
}
function toPayload(form: ActivityFormValues) {
  return {
    activityCategoryId: form.activityCategoryId,
    assignedUserId: form.assignedUserId.trim(),
    blockedReason: form.status === "blocked" ? form.blockedReason.trim() : null,
    containerId: form.containerId.trim(),
    containerType: form.containerType,
    customerCommitmentDate: form.isCustomerDeliverable ? form.customerCommitmentDate : null,
    description: form.description,
    estimatedHours: Number(form.estimatedHours),
    isCustomerDeliverable: form.isCustomerDeliverable,
    name: form.name.trim(),
    parentActivityId: form.parentActivityId.trim() || null,
    priority: form.priority,
    projectStageId: form.containerType === "project" ? form.projectStageId.trim() : undefined,
    status: form.status,
    targetDate: form.targetDate || null,
    waitingFor: form.status === "waiting_third_party" ? form.waitingFor : null,
    waitingReason: form.status === "waiting_third_party" ? form.waitingReason.trim() : null,
  };
}
const eventLabels: Record<ActivityAuditEvent["action"], string> = {
  create: "Actividad creada",
  delete: "Actividad eliminada",
  modify: "Actividad actualizada",
};
