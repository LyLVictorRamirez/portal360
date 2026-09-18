export interface AuthorizationAuditExecutor {
  query(query: string, values?: unknown[]): Promise<unknown>;
}

export type AuthorizationAuditEventType =
  | "authorization.role.activated"
  | "authorization.role.created"
  | "authorization.role.deactivated"
  | "authorization.role.deleted"
  | "authorization.role.updated"
  | "authorization.role_permission.assigned"
  | "authorization.role_permission.removed"
  | "authorization.user_role.assigned"
  | "authorization.user_role.removed";

export interface AuthorizationAuditEvent {
  actorUserId: string | null;
  afterState: Record<string, unknown> | null;
  beforeState: Record<string, unknown> | null;
  eventType: AuthorizationAuditEventType;
  subjectKey: string;
  subjectType: "role" | "role_permission" | "user_role";
}

const insertAuditEventQuery = `
  insert into "authorization"."audit_event" (
    "event_type",
    "actor_user_id",
    "subject_type",
    "subject_key",
    "before_state",
    "after_state"
  )
  values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
`;

export async function recordAuthorizationAuditEvent(
  database: AuthorizationAuditExecutor,
  event: AuthorizationAuditEvent,
): Promise<void> {
  await database.query(insertAuditEventQuery, [
    event.eventType,
    event.actorUserId,
    event.subjectType,
    event.subjectKey,
    event.beforeState ? JSON.stringify(event.beforeState) : null,
    event.afterState ? JSON.stringify(event.afterState) : null,
  ]);
}
