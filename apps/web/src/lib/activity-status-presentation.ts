import type { ActivityStatus } from "./activities-client.ts";

export type ActivityStatusTone =
  "analysis" | "approved" | "danger" | "info" | "paused" | "planned" | "success";

/**
 * Conserva la lectura de estados de Proyectos y Requerimientos: planificación
 * en azul, ejecución en verde, pausa en naranja, riesgo en rojo y cierre en azul informativo.
 */
export const activityStatusTones: Record<ActivityStatus, ActivityStatusTone> = {
  blocked: "danger",
  customer_testing: "approved",
  finalized: "info",
  in_progress: "success",
  in_review: "analysis",
  pending: "planned",
  waiting_third_party: "paused",
};
