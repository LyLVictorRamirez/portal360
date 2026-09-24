import type { Activity, ActivityPriority, ActivityStatus } from "../../../lib/activities-client";
import type { ActivityDescription } from "../../../lib/activity-description";

export type ActivityFormValues = Readonly<{
  activityCategoryId: string;
  assignedUserId: string;
  blockedReason: string;
  containerId: string;
  containerType: Activity["containerType"];
  customerCommitmentDate: string;
  description: ActivityDescription | null;
  estimatedHours: string;
  isCustomerDeliverable: boolean;
  name: string;
  parentActivityId: string;
  priority: ActivityPriority;
  projectStageId: string;
  status: ActivityStatus;
  targetDate: string;
  waitingFor: "" | "client" | "provider" | "other";
  waitingReason: string;
}>;

export type ActivityFormField =
  | "activityCategoryId"
  | "assignedUserId"
  | "blockedReason"
  | "containerId"
  | "customerCommitmentDate"
  | "estimatedHours"
  | "name"
  | "projectStageId"
  | "waitingFor"
  | "waitingReason";

export type ActivityFormErrors = Partial<Record<ActivityFormField, string>>;

const containerLabels: Record<Activity["containerType"], string> = {
  project: "Proyecto",
  requirement: "Requerimiento",
  ticket: "Ticket",
};

export function validateActivityForm(
  form: ActivityFormValues,
  isCreate: boolean,
): ActivityFormErrors {
  const errors: ActivityFormErrors = {};

  if (!form.name.trim()) errors.name = "Indica el nombre de la Actividad.";
  if (!form.activityCategoryId) errors.activityCategoryId = "Selecciona una categoría.";
  if (!form.assignedUserId.trim()) errors.assignedUserId = "Selecciona un responsable.";
  if (!form.estimatedHours) errors.estimatedHours = "Indica la estimación en horas.";
  else if (Number(form.estimatedHours) <= 0)
    errors.estimatedHours = "La estimación debe ser mayor que cero.";
  if (isCreate && !form.containerId.trim()) {
    errors.containerId = `Selecciona un ${containerLabels[form.containerType].toLowerCase()}.`;
  }
  if (isCreate && form.containerType === "project" && !form.projectStageId.trim()) {
    errors.projectStageId = "Selecciona una etapa del Proyecto.";
  }
  if (form.isCustomerDeliverable && !form.customerCommitmentDate) {
    errors.customerCommitmentDate = "Indica la fecha de compromiso con el cliente.";
  }
  if (form.status === "blocked" && !form.blockedReason.trim()) {
    errors.blockedReason = "Indica el motivo del bloqueo.";
  }
  if (form.status === "waiting_third_party" && !form.waitingFor) {
    errors.waitingFor = "Selecciona a quién se está esperando.";
  }
  if (form.status === "waiting_third_party" && !form.waitingReason.trim()) {
    errors.waitingReason = "Indica el motivo de espera.";
  }

  return errors;
}
