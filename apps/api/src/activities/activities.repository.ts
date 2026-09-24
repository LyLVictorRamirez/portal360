import { Inject, Injectable } from "@nestjs/common";

import {
  type Activity,
  type ActivityAssignee,
  type ActivityAuditEvent,
  ActivityAssigneeInvalidError,
  ActivityCategoryInactiveError,
  ActivityContainerNotFoundError,
  ActivityContainerTerminalError,
  ActivityNotFoundError,
  ActivityOrderError,
  ActivityRelatedRecordsError,
  ActivityValidationError,
  ActivityVersionConflictError,
  type CreateActivityRecordInput,
  type DeleteActivityInput,
  type ListActivitiesQuery,
  type ActivityList,
  type MoveActivityInput,
  type UpdateActivityRecordInput,
  activityPriorities,
  activityStatuses,
  activityWaitingForValues,
  type ActivityContainerType,
  type ActivityPriority,
  type ActivityStatus,
  type ActivityWaitingFor,
} from "./activities.contracts.js";
import { isActivityDescription } from "./activity-description.js";

export const ACTIVITIES_DATABASE = Symbol("ACTIVITIES_DATABASE");

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}
interface Transaction {
  query(query: string, values?: unknown[]): Promise<QueryResult>;
  release(): void;
}
export interface ActivitiesDatabase {
  connect(): Promise<Transaction>;
  query(query: string, values?: unknown[]): Promise<QueryResult>;
}

const activitySelection = (table: string) => `
  "${table}"."id", "${table}"."project_id", "${table}"."requirement_id", "${table}"."ticket_id",
  "${table}"."project_stage_id", "${table}"."parent_activity_id", "${table}"."assigned_user_id",
  "${table}"."activity_category_id", "${table}"."name", "${table}"."description", "${table}"."status",
  "${table}"."priority", "${table}"."estimated_hours", "${table}"."target_date",
  "${table}"."is_customer_deliverable", "${table}"."customer_commitment_date", "${table}"."position",
  "${table}"."blocked_reason", "${table}"."blocked_started_at", "${table}"."waiting_reason",
  "${table}"."waiting_for", "${table}"."waiting_started_at", "${table}"."version", "${table}"."created_at",
  "${table}"."created_by_user_id", "${table}"."updated_at", "${table}"."updated_by_user_id",
  (select "user"."name" from "auth"."user" as "user" where "user"."id" = "${table}"."assigned_user_id") as "assigned_user_name",
  coalesce(
    (select "project"."code" || ' · ' || "project"."name" from "business"."project" as "project" where "project"."id" = "${table}"."project_id"),
    (select "requirement"."code" || ' · ' || "requirement"."name" from "business"."requirement" as "requirement" where "requirement"."id" = "${table}"."requirement_id"),
    (select "ticket"."external_reference" || ' · ' || "ticket"."title" from "business"."ticket" as "ticket" where "ticket"."id" = "${table}"."ticket_id")
  ) as "container_name",
  coalesce(
    (select "client"."name" from "business"."project" as "project" inner join "business"."client" as "client" on "client"."id" = "project"."client_id" where "project"."id" = "${table}"."project_id"),
    (select "client"."name" from "business"."requirement" as "requirement" inner join "business"."client" as "client" on "client"."id" = "requirement"."client_id" where "requirement"."id" = "${table}"."requirement_id"),
    (select "client"."name" from "business"."ticket" as "ticket" inner join "business"."client" as "client" on "client"."id" = "ticket"."client_id" where "ticket"."id" = "${table}"."ticket_id")
  ) as "client_name",
  (select "stage"."name" from "business"."project_stage" as "stage" where "stage"."id" = "${table}"."project_stage_id") as "project_stage_name"
`;

const findActivityQuery = `select ${activitySelection("activity")} from "business"."activity" as "activity" where "activity"."id" = $1`;
const listAuditEventsQuery = `
  select "event"."id", "event"."action", "event"."actor_user_id", "event"."occurred_at", "event"."changes", "event"."reason",
    "user"."name" as "actor_user_name"
  from "business"."audit_event" as "event"
  inner join "auth"."user" as "user" on "user"."id" = "event"."actor_user_id"
  where "event"."entity_type" = 'activity' and "event"."entity_id" = $1
  order by "event"."occurred_at" desc, "event"."id" desc`;
const listAssigneesQuery = `
  select distinct "user"."id", "user"."name", "user"."email"
  from "auth"."user" as "user"
  inner join "authorization"."user_role" as "user_role" on "user_role"."user_id" = "user"."id"
  inner join "authorization"."role" as "role" on "role"."key" = "user_role"."role_key"
  inner join "authorization"."role_permission" as "role_permission"
    on "role_permission"."role_key" = "role"."key"
  where "user"."emailVerified"
    and "role"."is_active"
    and "role_permission"."permission_key" = 'app.access'
    and ($1::text = '' or "user"."name" ilike '%' || $1 || '%' or "user"."email" ilike '%' || $1 || '%')
  order by "user"."name" asc, "user"."email" asc
  limit 25`;
const listActivitiesQuery = `
  select ${activitySelection("activity")}
  from "business"."activity" as "activity"
  left join "business"."project" as "project" on "project"."id" = "activity"."project_id"
  left join "business"."requirement" as "requirement" on "requirement"."id" = "activity"."requirement_id"
  left join "business"."ticket" as "ticket" on "ticket"."id" = "activity"."ticket_id"
  where ($1::text is null or "activity"."name" ilike '%' || $1 || '%')
    and ($2::uuid is null or coalesce("project"."client_id", "requirement"."client_id", "ticket"."client_id") = $2)
    and ($3::text is null or case when "activity"."project_id" is not null then 'project' when "activity"."requirement_id" is not null then 'requirement' else 'ticket' end = $3)
    and ($4::uuid is null or coalesce("activity"."project_id", "activity"."requirement_id", "activity"."ticket_id") = $4)
    and ($5::text is null or "activity"."assigned_user_id" = $5)
    and ($6::text is null or "activity"."status" = $6)
    and ($7::text is null or "activity"."priority" = $7)
    and ($8::uuid is null or "activity"."activity_category_id" = $8)
  order by "activity"."updated_at" desc, "activity"."id" desc
  limit $9 offset $10`;
const countActivitiesQuery = `
  select count(*)::integer as "total" from (${listActivitiesQuery.replace(/order by[\s\S]*/, "")}) as "listed"`;

@Injectable()
export class ActivityRepository {
  constructor(@Inject(ACTIVITIES_DATABASE) private readonly database: ActivitiesDatabase) {}

  async getActivity(activityId: string): Promise<Activity> {
    const result = await this.database.query(findActivityQuery, [activityId]);
    if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
    return readActivity(result.rows[0]);
  }

  async listAuditEvents(activityId: string): Promise<ActivityAuditEvent[]> {
    const result = await this.database.query(listAuditEventsQuery, [activityId]);
    return result.rows.map(readAuditEvent);
  }

  async listAssignees(query: string): Promise<ActivityAssignee[]> {
    const result = await this.database.query(listAssigneesQuery, [query]);
    return result.rows.map(readActivityAssignee);
  }

  async listActivities(query: ListActivitiesQuery): Promise<ActivityList> {
    const values = [
      query.query,
      query.clientId,
      query.containerType,
      query.containerId,
      query.assignedUserId,
      query.status,
      query.priority,
      query.activityCategoryId,
    ];
    const offset = (query.page - 1) * query.pageSize;
    const [listed, counted] = await Promise.all([
      this.database.query(listActivitiesQuery, [...values, query.pageSize, offset]),
      this.database.query(countActivitiesQuery, values),
    ]);
    const count = counted.rows[0];
    if (!count) throw new Error("The business database did not return the Activity count.");
    return {
      activities: listed.rows.map(readActivity),
      page: query.page,
      pageSize: query.pageSize,
      total: readNonNegativeInteger(count.total, "Activity count"),
    };
  }

  async createActivity(input: CreateActivityRecordInput): Promise<Activity> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      await assertContainerAllowsActivities(transaction, input.containerType, input.containerId);
      await assertActiveCategory(transaction, input.activityCategoryId);
      await assertAvailableAssignee(transaction, input.assignedUserId);
      const ids = containerIds(input.containerType, input.containerId);
      const positionResult = await transaction.query(
        `select coalesce(max("position"), 0)::integer + 1 as "position" from "business"."activity" where "project_id" is not distinct from $1 and "requirement_id" is not distinct from $2 and "ticket_id" is not distinct from $3 and "parent_activity_id" is not distinct from $4`,
        [...ids, input.parentActivityId],
      );
      const position = readPositiveInteger(positionResult.rows[0]?.position, "Activity position");
      const result = await transaction.query(
        `insert into "business"."activity" ("project_id", "requirement_id", "ticket_id", "project_stage_id", "parent_activity_id", "assigned_user_id", "activity_category_id", "name", "description", "status", "priority", "estimated_hours", "target_date", "is_customer_deliverable", "customer_commitment_date", "position", "blocked_reason", "blocked_started_at", "waiting_reason", "waiting_for", "waiting_started_at", "created_by_user_id", "updated_by_user_id") values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,case when $17::varchar is null then null else current_timestamp end,$18, $19, case when $18::varchar is null then null else current_timestamp end,$20,$20) returning *`,
        [
          ...ids,
          input.projectStageId ?? null,
          input.parentActivityId ?? null,
          input.assignedUserId,
          input.activityCategoryId,
          input.name,
          input.description ? JSON.stringify(input.description) : null,
          input.status,
          input.priority,
          input.estimatedHours,
          input.targetDate ?? null,
          input.isCustomerDeliverable,
          input.customerCommitmentDate ?? null,
          position,
          input.blockedReason ?? null,
          input.waitingReason ?? null,
          input.waitingFor ?? null,
          input.actorUserId,
        ],
      );
      if (!result.rows[0])
        throw new Error("The business database did not return the created Activity.");
      const created = await getActivityForUpdate(
        transaction,
        readString(result.rows[0].id, "Created Activity id"),
      );
      await recordAuditEvent(transaction, input.actorUserId, "create", null, created);
      await transaction.query("COMMIT");
      return created;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  async updateActivity(activityId: string, input: UpdateActivityRecordInput): Promise<Activity> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const current = await getActivityForUpdate(transaction, activityId);
      if (current.version !== input.version)
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload it before saving again.",
        );
      if (input.activityCategoryId !== undefined)
        await assertActiveCategory(transaction, input.activityCategoryId);
      if (input.assignedUserId !== undefined)
        await assertAvailableAssignee(transaction, input.assignedUserId);
      await assertContainerAllowsActivities(
        transaction,
        current.containerType,
        current.containerId,
      );
      const { sql, values } = buildUpdateQuery(activityId, input);
      const result = await transaction.query(sql, values);
      if (!result.rows[0])
        throw new Error("The business database did not return the updated Activity.");
      const updated = await getActivityForUpdate(transaction, activityId);
      await recordAuditEvent(transaction, input.actorUserId, "modify", current, updated);
      await transaction.query("COMMIT");
      return updated;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  async deleteActivity(
    activityId: string,
    input: DeleteActivityInput & { actorUserId: string },
  ): Promise<void> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const current = await getActivityForUpdate(transaction, activityId);
      if (current.version !== input.version)
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload it before deleting.",
        );
      await recordAuditEvent(transaction, input.actorUserId, "delete", current, null);
      const result = await transaction.query(
        `delete from "business"."activity" where "id" = $1 returning "id"`,
        [activityId],
      );
      if (!result.rows[0]) throw new Error("The business database did not delete the Activity.");
      await transaction.query("COMMIT");
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  async moveActivity(
    activityId: string,
    input: MoveActivityInput & { actorUserId: string },
  ): Promise<Activity> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const current = await getActivityForUpdate(transaction, activityId);
      if (current.version !== input.version)
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload it before moving.",
        );
      const neighborPosition = current.position + (input.direction === "up" ? -1 : 1);
      if (neighborPosition < 1)
        throw new ActivityOrderError("The first Activity cannot be moved up.");
      const sibling = await transaction.query(
        `select ${activitySelection("activity")} from "business"."activity" as "activity" where "position" = $1 and "parent_activity_id" is not distinct from $2 and (($4 = 'project' and "project_id" = $3) or ($4 = 'requirement' and "requirement_id" = $3) or ($4 = 'ticket' and "ticket_id" = $3)) for update`,
        [neighborPosition, current.parentActivityId, current.containerId, current.containerType],
      );
      if (!sibling.rows[0]) throw new ActivityOrderError("The last Activity cannot be moved down.");
      const neighbor = readActivity(sibling.rows[0]);
      await transaction.query(
        `update "business"."activity" set "position" = -"position" where "id" in ($1, $2)`,
        [current.id, neighbor.id],
      );
      await transaction.query(
        `update "business"."activity" set "position" = $2, "updated_at" = current_timestamp, "updated_by_user_id" = $3, "version" = "version" + 1 where "id" = $1`,
        [neighbor.id, current.position, input.actorUserId],
      );
      const moved = await transaction.query(
        `update "business"."activity" set "position" = $2, "updated_at" = current_timestamp, "updated_by_user_id" = $3, "version" = "version" + 1 where "id" = $1 returning *`,
        [current.id, neighbor.position, input.actorUserId],
      );
      if (!moved.rows[0])
        throw new Error("The business database did not return the moved Activity.");
      const movedActivity = await getActivityForUpdate(transaction, activityId);
      await recordAuditEvent(transaction, input.actorUserId, "modify", current, movedActivity);
      await transaction.query("COMMIT");
      return movedActivity;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }
}

function buildUpdateQuery(
  activityId: string,
  input: UpdateActivityRecordInput,
): { sql: string; values: unknown[] } {
  const columns: Array<[string, unknown]> = [];
  for (const [column, value] of Object.entries({
    name: input.name,
    description:
      input.description === undefined
        ? undefined
        : input.description === null
          ? null
          : JSON.stringify(input.description),
    activity_category_id: input.activityCategoryId,
    assigned_user_id: input.assignedUserId,
    status: input.status,
    priority: input.priority,
    estimated_hours: input.estimatedHours,
    target_date: input.targetDate,
    is_customer_deliverable: input.isCustomerDeliverable,
    customer_commitment_date: input.customerCommitmentDate,
    project_stage_id: input.projectStageId,
    parent_activity_id: input.parentActivityId,
    blocked_reason: input.blockedReason,
    blocked_started_at: input.blockedStartedAt,
    waiting_reason: input.waitingReason,
    waiting_for: input.waitingFor,
    waiting_started_at: input.waitingStartedAt,
  })) {
    if (value !== undefined) columns.push([column, value]);
  }
  const values: unknown[] = [activityId];
  const assignments = columns.map(([column, value], index) => {
    values.push(value);
    return `"${column}" = $${index + 2}`;
  });
  values.push(input.actorUserId);
  assignments.push(
    `"updated_at" = current_timestamp`,
    `"updated_by_user_id" = $${values.length}`,
    `"version" = "version" + 1`,
  );
  return {
    sql: `update "business"."activity" set ${assignments.join(", ")} where "id" = $1 returning *`,
    values,
  };
}

async function getActivityForUpdate(
  transaction: Transaction,
  activityId: string,
): Promise<Activity> {
  const result = await transaction.query(`${findActivityQuery} for update`, [activityId]);
  if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
  return readActivity(result.rows[0]);
}
function containerIds(
  type: ActivityContainerType,
  id: string,
): [string | null, string | null, string | null] {
  return type === "project"
    ? [id, null, null]
    : type === "requirement"
      ? [null, id, null]
      : [null, null, id];
}
async function assertContainerAllowsActivities(
  transaction: Transaction,
  type: ActivityContainerType,
  id: string,
): Promise<void> {
  const table = type === "project" ? "project" : type === "requirement" ? "requirement" : "ticket";
  const result = await transaction.query(containerActivityLockQuery(type, table), [id]);
  const row = result.rows[0];
  if (!row)
    throw new ActivityContainerNotFoundError(`The Activity ${type} container does not exist.`);
  if (
    (type === "project" && (row.status === "finalized" || row.status === "cancelled")) ||
    (type === "requirement" && (row.status === "finalized" || row.status === "cancelled"))
  )
    throw new ActivityContainerTerminalError(
      "Activities cannot be changed in a terminal container.",
    );
}

export function containerActivityLockQuery(type: ActivityContainerType, table: string): string {
  const selection = type === "ticket" ? '"id"' : '"status"';
  return `select ${selection} from "business"."${table}" where "id" = $1 for update`;
}
async function assertActiveCategory(transaction: Transaction, id: string): Promise<void> {
  const result = await transaction.query(
    `select "is_active" from "business"."activity_category" where "id" = $1 for update`,
    [id],
  );
  if (!result.rows[0] || result.rows[0].is_active !== true)
    throw new ActivityCategoryInactiveError("The Activity category is inactive or does not exist.");
}
async function assertAvailableAssignee(transaction: Transaction, id: string): Promise<void> {
  const result = await transaction.query(
    `select
      "user"."emailVerified" as "email_verified",
      exists (
        select 1
        from "authorization"."user_role" as "user_role"
        inner join "authorization"."role" as "role" on "role"."key" = "user_role"."role_key"
        inner join "authorization"."role_permission" as "role_permission"
          on "role_permission"."role_key" = "role"."key"
        where "user_role"."user_id" = "user"."id"
          and "role"."is_active"
          and "role_permission"."permission_key" = 'app.access'
      ) as "has_access"
    from "auth"."user" as "user"
    where "user"."id" = $1`,
    [id],
  );
  if (
    !result.rows[0] ||
    result.rows[0].email_verified !== true ||
    result.rows[0].has_access !== true
  )
    throw new ActivityAssigneeInvalidError(
      "The Activity assignee must be a verified account with access to the application.",
    );
}
function readActivity(row: Record<string, unknown>): Activity {
  const type: ActivityContainerType =
    row.project_id !== null ? "project" : row.requirement_id !== null ? "requirement" : "ticket";
  const id =
    type === "project"
      ? row.project_id
      : type === "requirement"
        ? row.requirement_id
        : row.ticket_id;
  return {
    activityCategoryId: readString(row.activity_category_id, "Activity category id"),
    assignedUserId: readString(row.assigned_user_id, "Activity assignee id"),
    assignedUserName: readString(row.assigned_user_name, "Activity assignee name"),
    blockedReason: nullableString(row.blocked_reason, "Blocked reason"),
    blockedStartedAt: nullableDate(row.blocked_started_at, "Blocked date"),
    clientName: readString(row.client_name, "Activity Client name"),
    containerId: readString(id, "Activity container id"),
    containerName: readString(row.container_name, "Activity container name"),
    containerType: type,
    createdAt: readDate(row.created_at, "Activity creation date"),
    createdByUserId: readString(row.created_by_user_id, "Activity creator"),
    customerCommitmentDate: nullableDateOnly(
      row.customer_commitment_date,
      "Customer commitment date",
    ),
    description: readDescription(row.description),
    estimatedHours: readNumber(row.estimated_hours, "Estimated hours"),
    id: readString(row.id, "Activity id"),
    isCustomerDeliverable: readBoolean(row.is_customer_deliverable, "Customer deliverable"),
    name: readString(row.name, "Activity name"),
    parentActivityId: nullableString(row.parent_activity_id, "Activity parent id"),
    position: readPositiveInteger(row.position, "Activity position"),
    priority: readPriority(row.priority),
    projectStageId: nullableString(row.project_stage_id, "Project Stage id"),
    projectStageName: nullableString(row.project_stage_name, "Project Stage name"),
    status: readStatus(row.status),
    targetDate: nullableDateOnly(row.target_date, "Target date"),
    updatedAt: readDate(row.updated_at, "Activity update date"),
    updatedByUserId: readString(row.updated_by_user_id, "Activity updater"),
    version: readPositiveInteger(row.version, "Activity version"),
    waitingFor: nullableWaitingFor(row.waiting_for),
    waitingReason: nullableString(row.waiting_reason, "Waiting reason"),
    waitingStartedAt: nullableDate(row.waiting_started_at, "Waiting date"),
  };
}
function readString(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new Error(`Invalid ${field} returned by the business database.`);
  return value;
}
function nullableString(value: unknown, field: string): string | null {
  return value === null ? null : readString(value, field);
}
function readDescription(value: unknown) {
  if (value === null) return null;
  if (!isActivityDescription(value))
    throw new Error("Invalid Activity description returned by the business database.");
  return value;
}
function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean")
    throw new Error(`Invalid ${field} returned by the business database.`);
  return value;
}
function readDate(value: unknown, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime()))
    throw new Error(`Invalid ${field} returned by the business database.`);
  return value;
}
function nullableDate(value: unknown, field: string): Date | null {
  return value === null ? null : readDate(value, field);
}
function nullableDateOnly(value: unknown, field: string): string | null {
  if (value === null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return value.toISOString().slice(0, 10);
  throw new Error(`Invalid ${field} returned by the business database.`);
}
function readNumber(value: unknown, field: string): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value)
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number) || number <= 0)
    throw new Error(`Invalid ${field} returned by the business database.`);
  return number;
}
function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1)
    throw new Error(`Invalid ${field} returned by the business database.`);
  return value;
}
function readNonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new Error(`Invalid ${field} returned by the business database.`);
  return value;
}
function readStatus(value: unknown): ActivityStatus {
  if (!(activityStatuses as readonly string[]).includes(value as string))
    throw new Error("Invalid Activity status returned by the business database.");
  return value as ActivityStatus;
}
function readPriority(value: unknown): ActivityPriority {
  if (!(activityPriorities as readonly string[]).includes(value as string))
    throw new Error("Invalid Activity priority returned by the business database.");
  return value as ActivityPriority;
}
function nullableWaitingFor(value: unknown): ActivityWaitingFor | null {
  if (value === null) return null;
  if (!(activityWaitingForValues as readonly string[]).includes(value as string))
    throw new Error("Invalid Activity waiting target returned by the business database.");
  return value as ActivityWaitingFor;
}
async function recordAuditEvent(
  transaction: Transaction,
  actorUserId: string,
  action: "create" | "modify" | "delete",
  before: Activity | null,
  after: Activity | null,
): Promise<void> {
  const entityId = after?.id ?? before?.id;
  if (!entityId) throw new Error("Activity audit events require an Activity id.");
  await transaction.query(
    `insert into "business"."audit_event" ("entity_type", "entity_id", "action", "actor_user_id", "occurred_at", "changes") values ('activity', $1, $2, $3, current_timestamp, $4::jsonb)`,
    [entityId, action, actorUserId, JSON.stringify(activityChanges(before, after))],
  );
}
function activityChanges(
  before: Activity | null,
  after: Activity | null,
): Record<string, { after: unknown; before: unknown }> {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: Record<string, { after: unknown; before: unknown }> = {};
  for (const key of keys) {
    const previous = before ? before[key as keyof Activity] : null;
    const next = after ? after[key as keyof Activity] : null;
    if (JSON.stringify(previous) !== JSON.stringify(next))
      changes[key] = { after: next, before: previous };
  }
  return changes;
}
function readAuditEvent(row: Record<string, unknown>): ActivityAuditEvent {
  const changes = row.changes;
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new Error("Invalid Activity audit changes returned by the business database.");
  }
  const action = row.action;
  if (action !== "create" && action !== "modify" && action !== "delete") {
    throw new Error("Invalid Activity audit action returned by the business database.");
  }
  return {
    action,
    actorUserId: readString(row.actor_user_id, "Activity audit actor"),
    actorUserName: readString(row.actor_user_name, "Activity audit actor name"),
    changes: changes as Record<string, { after: unknown; before: unknown }>,
    id: readString(row.id, "Activity audit id"),
    occurredAt: readDate(row.occurred_at, "Activity audit date"),
    reason: nullableString(row.reason, "Activity audit reason"),
  };
}
function readActivityAssignee(row: Record<string, unknown>): ActivityAssignee {
  return {
    email: readString(row.email, "Activity assignee email"),
    id: readString(row.id, "Activity assignee id"),
    name: readString(row.name, "Activity assignee name"),
  };
}
function mapDatabaseError(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "23503")
      return new ActivityRelatedRecordsError(
        "The Activity has related records or an invalid relation.",
      );
    if (code === "23505" || code === "23514")
      return new ActivityValidationError("The Activity data does not satisfy its business rules.");
  }
  return error;
}
