import { Inject, Injectable } from "@nestjs/common";

import {
  type Activity,
  type ActivityAssignee,
  type ActivityAuditEvent,
  type ActivityDependencies,
  type ActivityDependency,
  type ActivityDetail,
  ActivityAssigneeInvalidError,
  ActivityCategoryInactiveError,
  ActivityContainerNotFoundError,
  ActivityContainerTerminalError,
  ActivityDependencyValidationError,
  ActivityNotFoundError,
  ActivityOrderError,
  ActivityRelatedRecordsError,
  ActivityTreeLimitError,
  ActivityValidationError,
  ActivityVersionConflictError,
  type CreateActivityRecordInput,
  type CreateActivityDependencyRecordInput,
  type DeleteActivityDependencyRecordInput,
  type DeleteActivityInput,
  type ListActivitiesQuery,
  type ListActivityTreeQuery,
  type ActivityList,
  type RelocateActivityRecordInput,
  type ActivityTree,
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
const listPredecessorsQuery = `
  select "activity"."id", "activity"."name", "activity"."status", "activity"."version"
  from "business"."activity_dependency" as "dependency"
  inner join "business"."activity" as "activity"
    on "activity"."id" = "dependency"."predecessor_activity_id"
  where "dependency"."successor_activity_id" = $1
  order by "activity"."name" asc, "activity"."id" asc`;
const listSuccessorsQuery = `
  select "activity"."id", "activity"."name", "activity"."status", "activity"."version"
  from "business"."activity_dependency" as "dependency"
  inner join "business"."activity" as "activity"
    on "activity"."id" = "dependency"."successor_activity_id"
  where "dependency"."predecessor_activity_id" = $1
  order by "activity"."name" asc, "activity"."id" asc`;
const listRelatedActivityNamesQuery = `
  select "activity"."name"
  from "business"."activity_dependency" as "dependency"
  inner join "business"."activity" as "activity"
    on "activity"."id" = case
      when "dependency"."predecessor_activity_id" = $1 then "dependency"."successor_activity_id"
      else "dependency"."predecessor_activity_id"
    end
  where "dependency"."predecessor_activity_id" = $1 or "dependency"."successor_activity_id" = $1
  order by "activity"."name" asc, "activity"."id" asc`;
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
    and ($5::uuid is null or "activity"."project_stage_id" = $5)
    and ($6::text is null or "activity"."assigned_user_id" = $6)
    and ($7::text is null or "activity"."status" = $7)
    and ($8::text is null or "activity"."priority" = $8)
    and ($9::uuid is null or "activity"."activity_category_id" = $9)
  order by "activity"."updated_at" desc, "activity"."id" desc
  limit $10 offset $11`;
const countActivitiesQuery = `
  select count(*)::integer as "total" from (${listActivitiesQuery.replace(/order by[\s\S]*/, "")}) as "listed"`;
const activityTreeLimit = 500;
const listActivityTreeQuery = `
  with recursive matching_activity as (
    select "activity"."id"
    from "business"."activity" as "activity"
    left join "business"."project" as "project" on "project"."id" = "activity"."project_id"
    left join "business"."requirement" as "requirement" on "requirement"."id" = "activity"."requirement_id"
    left join "business"."ticket" as "ticket" on "ticket"."id" = "activity"."ticket_id"
    where ($1::text is null or "activity"."name" ilike '%' || $1 || '%')
      and ($2::uuid is null or coalesce("project"."client_id", "requirement"."client_id", "ticket"."client_id") = $2)
      and ($3::text is null or case when "activity"."project_id" is not null then 'project' when "activity"."requirement_id" is not null then 'requirement' else 'ticket' end = $3)
      and ($4::uuid is null or coalesce("activity"."project_id", "activity"."requirement_id", "activity"."ticket_id") = $4)
      and ($5::uuid is null or "activity"."project_stage_id" = $5)
      and ($6::text is null or "activity"."assigned_user_id" = $6)
      and ($7::text is null or "activity"."status" = $7)
      and ($8::text is null or "activity"."priority" = $8)
      and ($9::uuid is null or "activity"."activity_category_id" = $9)
  ), contextual_activity as (
    select "activity"."id", "activity"."parent_activity_id"
    from "business"."activity" as "activity"
    inner join matching_activity on matching_activity."id" = "activity"."id"
    union
    select "parent"."id", "parent"."parent_activity_id"
    from "business"."activity" as "parent"
    inner join contextual_activity on contextual_activity."parent_activity_id" = "parent"."id"
  ), tree_activity as (
    select contextual_activity."id", contextual_activity."parent_activity_id",
      array["activity"."position"] as "sort_path"
    from contextual_activity
    inner join "business"."activity" as "activity" on "activity"."id" = contextual_activity."id"
    where contextual_activity."parent_activity_id" is null
    union all
    select contextual_activity."id", contextual_activity."parent_activity_id",
      tree_activity."sort_path" || "activity"."position"
    from contextual_activity
    inner join tree_activity on tree_activity."id" = contextual_activity."parent_activity_id"
    inner join "business"."activity" as "activity" on "activity"."id" = contextual_activity."id"
  )
  select ${activitySelection("activity")},
    exists (select 1 from matching_activity where matching_activity."id" = "activity"."id") as "matches_filter"
  from tree_activity
  inner join "business"."activity" as "activity" on "activity"."id" = tree_activity."id"
  order by tree_activity."sort_path", "activity"."id"
  limit $10`;

@Injectable()
export class ActivityRepository {
  constructor(@Inject(ACTIVITIES_DATABASE) private readonly database: ActivitiesDatabase) {}

  async getActivity(activityId: string): Promise<ActivityDetail> {
    const result = await this.database.query(findActivityQuery, [activityId]);
    if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
    return {
      ...readActivity(result.rows[0]),
      dependencies: await this.readActivityDependencies(activityId),
    };
  }

  async listActivityDependencies(activityId: string): Promise<ActivityDependencies> {
    await this.getActivity(activityId);
    return this.readActivityDependencies(activityId);
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
      query.projectStageId,
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

  async listActivityTree(query: ListActivityTreeQuery): Promise<ActivityTree> {
    const result = await this.database.query(listActivityTreeQuery, [
      query.query,
      query.clientId,
      query.containerType,
      query.containerId,
      query.projectStageId,
      query.assignedUserId,
      query.status,
      query.priority,
      query.activityCategoryId,
      activityTreeLimit + 1,
    ]);
    if (result.rows.length > activityTreeLimit) {
      throw new ActivityTreeLimitError(
        "The Activity tree contains more than 500 contextual rows. Refine the filters.",
      );
    }
    return {
      activities: result.rows.map((row) => ({
        ...readActivity(row),
        matchesFilter: readBoolean(row.matches_filter, "Activity filter match"),
      })),
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
      const relatedActivities = await transaction.query(listRelatedActivityNamesQuery, [
        activityId,
      ]);
      if (relatedActivities.rows.length > 0) {
        throw new ActivityRelatedRecordsError(
          "The Activity cannot be deleted while it has dependencies.",
          relatedActivities.rows.map((row) => readString(row.name, "Related Activity name")),
        );
      }
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

  async relocateActivity(
    activityId: string,
    input: RelocateActivityRecordInput,
  ): Promise<Activity> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const requested = await getActivity(transaction, activityId);
      await assertContainerAllowsActivities(
        transaction,
        requested.containerType,
        requested.containerId,
      );
      const activities = await listActivitiesForContainerForUpdate(transaction, requested);
      const current = activities.find((activity) => activity.id === activityId);
      if (!current) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
      if (current.version !== input.version) {
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload the tree before moving it.",
        );
      }

      const target = input.targetActivityId
        ? activities.find((activity) => activity.id === input.targetActivityId)
        : null;
      if (input.placement === "last") {
        if (target) throw new ActivityValidationError("The last placement cannot have a target.");
      } else if (!target) {
        throw new ActivityValidationError("The Activity move target does not exist.");
      }

      if (
        target &&
        (target.containerType !== current.containerType ||
          target.containerId !== current.containerId ||
          target.projectStageId !== current.projectStageId)
      ) {
        throw new ActivityValidationError(
          "Activities can only be moved within the same container and Project Stage.",
        );
      }

      const descendantIds = collectDescendantIds(activities, current.id);
      if (target && descendantIds.has(target.id)) {
        throw new ActivityValidationError("An Activity cannot be moved into its own subtree.");
      }

      const destinationParentId =
        input.placement === "inside" ? (target?.id ?? null) : (target?.parentActivityId ?? null);
      const subtreeDepth = maxSubtreeDepth(activities, current.id);
      const destinationDepth = destinationParentId
        ? activityDepth(activities, destinationParentId) + 1
        : 1;
      if (destinationDepth + subtreeDepth - 1 > 4) {
        throw new ActivityValidationError(
          "The Activity subtree cannot be moved below the fourth hierarchy level.",
        );
      }

      const before = new Map(activities.map((activity) => [activity.id, activity]));
      const sourceSiblings = siblingsOf(activities, current.parentActivityId).filter(
        (activity) => activity.id !== current.id,
      );
      const destinationSiblings = siblingsOf(activities, destinationParentId).filter(
        (activity) => activity.id !== current.id,
      );
      const insertionIndex =
        input.placement === "before"
          ? destinationSiblings.findIndex((activity) => activity.id === target?.id)
          : input.placement === "after"
            ? destinationSiblings.findIndex((activity) => activity.id === target?.id) + 1
            : destinationSiblings.length;
      if (insertionIndex < 0)
        throw new ActivityValidationError("The Activity move target is invalid.");
      destinationSiblings.splice(insertionIndex, 0, current);

      const desired = new Map<string, { parentActivityId: string | null; position: number }>();
      for (const [index, activity] of sourceSiblings.entries()) {
        desired.set(activity.id, {
          parentActivityId: current.parentActivityId,
          position: index + 1,
        });
      }
      for (const [index, activity] of destinationSiblings.entries()) {
        desired.set(activity.id, { parentActivityId: destinationParentId, position: index + 1 });
      }

      const changes = [...desired.entries()].filter(([id, next]) => {
        const previous = before.get(id);
        return (
          previous &&
          (previous.parentActivityId !== next.parentActivityId ||
            previous.position !== next.position)
        );
      });
      if (changes.length === 0) {
        throw new ActivityOrderError("The Activity is already in that position.");
      }

      const temporaryOffset =
        Math.max(...activities.map((activity) => activity.position)) + changes.length + 1;
      await transaction.query(
        `update "business"."activity" set "position" = "position" + $2 where "id" = any($1::uuid[])`,
        [changes.map(([id]) => id), temporaryOffset],
      );
      for (const [id, next] of changes) {
        await transaction.query(
          `update "business"."activity" set "parent_activity_id" = $2, "position" = $3, "updated_at" = current_timestamp, "updated_by_user_id" = $4, "version" = "version" + 1 where "id" = $1`,
          [id, next.parentActivityId, next.position, input.actorUserId],
        );
      }
      for (const [id] of changes) {
        await recordAuditEvent(
          transaction,
          input.actorUserId,
          "modify",
          before.get(id) ?? null,
          await getActivityForUpdate(transaction, id),
        );
      }
      const relocated = await getActivityForUpdate(transaction, current.id);
      await transaction.query("COMMIT");
      return relocated;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  async createActivityDependency(
    successorActivityId: string,
    input: CreateActivityDependencyRecordInput,
  ): Promise<ActivityDependencies> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const successor = await getActivityForUpdate(transaction, successorActivityId);
      if (successor.version !== input.version) {
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload it before changing dependencies.",
        );
      }
      const predecessor = await getActivity(transaction, input.predecessorActivityId);
      await assertValidActivityDependency(transaction, predecessor, successor);
      await transaction.query(
        `insert into "business"."activity_dependency" ("predecessor_activity_id", "successor_activity_id", "created_by_user_id") values ($1, $2, $3)`,
        [predecessor.id, successor.id, input.actorUserId],
      );
      await touchActivity(transaction, successor.id, input.actorUserId);
      await recordActivityDependencyAudit(
        transaction,
        input.actorUserId,
        successor.id,
        "predecessors",
        predecessor,
        null,
      );
      await recordActivityDependencyAudit(
        transaction,
        input.actorUserId,
        predecessor.id,
        "successors",
        successor,
        null,
      );
      const dependencies = await readActivityDependencies(transaction, successor.id);
      await transaction.query("COMMIT");
      return dependencies;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  async deleteActivityDependency(
    successorActivityId: string,
    predecessorActivityId: string,
    input: DeleteActivityDependencyRecordInput,
  ): Promise<ActivityDependencies> {
    const transaction = await this.database.connect();
    try {
      await transaction.query("BEGIN");
      const successor = await getActivityForUpdate(transaction, successorActivityId);
      if (successor.version !== input.version) {
        throw new ActivityVersionConflictError(
          "The Activity was updated by another person. Reload it before changing dependencies.",
        );
      }
      const predecessor = await getActivity(transaction, predecessorActivityId);
      const removed = await transaction.query(
        `delete from "business"."activity_dependency" where "predecessor_activity_id" = $1 and "successor_activity_id" = $2 returning "predecessor_activity_id"`,
        [predecessor.id, successor.id],
      );
      if (!removed.rows[0]) {
        throw new ActivityDependencyValidationError("The Activity dependency does not exist.");
      }
      await touchActivity(transaction, successor.id, input.actorUserId);
      await recordActivityDependencyAudit(
        transaction,
        input.actorUserId,
        successor.id,
        "predecessors",
        null,
        predecessor,
      );
      await recordActivityDependencyAudit(
        transaction,
        input.actorUserId,
        predecessor.id,
        "successors",
        null,
        successor,
      );
      const dependencies = await readActivityDependencies(transaction, successor.id);
      await transaction.query("COMMIT");
      return dependencies;
    } catch (error) {
      await transaction.query("ROLLBACK");
      throw mapDatabaseError(error);
    } finally {
      transaction.release();
    }
  }

  private async readActivityDependencies(activityId: string): Promise<ActivityDependencies> {
    return readActivityDependencies(this.database, activityId);
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

async function listActivitiesForContainerForUpdate(
  transaction: Transaction,
  activity: Activity,
): Promise<Activity[]> {
  const [projectId, requirementId, ticketId] = containerIds(
    activity.containerType,
    activity.containerId,
  );
  const result = await transaction.query(
    `select ${activitySelection("activity")}
    from "business"."activity" as "activity"
    where "activity"."project_id" is not distinct from $1
      and "activity"."requirement_id" is not distinct from $2
      and "activity"."ticket_id" is not distinct from $3
    order by "activity"."parent_activity_id" nulls first, "activity"."position", "activity"."id"
    for update`,
    [projectId, requirementId, ticketId],
  );
  return result.rows.map(readActivity);
}
function siblingsOf(activities: readonly Activity[], parentActivityId: string | null): Activity[] {
  return activities
    .filter((activity) => activity.parentActivityId === parentActivityId)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
}
function collectDescendantIds(activities: readonly Activity[], activityId: string): Set<string> {
  const descendants = new Set([activityId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const activity of activities) {
      if (
        activity.parentActivityId &&
        descendants.has(activity.parentActivityId) &&
        !descendants.has(activity.id)
      ) {
        descendants.add(activity.id);
        changed = true;
      }
    }
  }
  return descendants;
}
function activityDepth(activities: readonly Activity[], activityId: string): number {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  let current = byId.get(activityId);
  let depth = 0;
  const visited = new Set<string>();
  while (current) {
    if (visited.has(current.id))
      throw new ActivityValidationError("The Activity hierarchy has a cycle.");
    visited.add(current.id);
    depth += 1;
    current = current.parentActivityId ? byId.get(current.parentActivityId) : undefined;
  }
  return depth;
}
function maxSubtreeDepth(activities: readonly Activity[], activityId: string): number {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const descendants = collectDescendantIds(activities, activityId);
  let maximum = 1;
  for (const descendantId of descendants) {
    let depth = 1;
    let current = byId.get(descendantId);
    while (current?.parentActivityId) {
      depth += 1;
      if (current.parentActivityId === activityId) break;
      current = byId.get(current.parentActivityId);
    }
    maximum = Math.max(maximum, depth);
  }
  return maximum;
}
async function getActivityForUpdate(
  transaction: Transaction,
  activityId: string,
): Promise<Activity> {
  const result = await transaction.query(`${findActivityQuery} for update`, [activityId]);
  if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
  return readActivity(result.rows[0]);
}
async function getActivity(transaction: Transaction, activityId: string): Promise<Activity> {
  const result = await transaction.query(findActivityQuery, [activityId]);
  if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
  return readActivity(result.rows[0]);
}
async function readActivityDependencies(
  database: Pick<ActivitiesDatabase, "query">,
  activityId: string,
): Promise<ActivityDependencies> {
  const [predecessors, successors] = await Promise.all([
    database.query(listPredecessorsQuery, [activityId]),
    database.query(listSuccessorsQuery, [activityId]),
  ]);
  return {
    predecessors: predecessors.rows.map(readActivityDependency),
    successors: successors.rows.map(readActivityDependency),
  };
}
async function assertValidActivityDependency(
  transaction: Transaction,
  predecessor: Activity,
  successor: Activity,
): Promise<void> {
  if (predecessor.id === successor.id) {
    throw new ActivityDependencyValidationError("An Activity cannot depend on itself.");
  }
  if (
    predecessor.containerType !== successor.containerType ||
    predecessor.containerId !== successor.containerId
  ) {
    throw new ActivityDependencyValidationError(
      "Activity dependencies must use Activities in the same container.",
    );
  }
  const existing = await transaction.query(
    `select 1 from "business"."activity_dependency" where "predecessor_activity_id" = $1 and "successor_activity_id" = $2`,
    [predecessor.id, successor.id],
  );
  if (existing.rows[0]) {
    throw new ActivityDependencyValidationError("The Activity dependency already exists.");
  }
  const cycle = await transaction.query(
    `with recursive descendants("activity_id") as (
      select $1::uuid
      union
      select "dependency"."successor_activity_id"
      from "business"."activity_dependency" as "dependency"
      inner join descendants on "dependency"."predecessor_activity_id" = descendants."activity_id"
    )
    select 1 from descendants where "activity_id" = $2::uuid`,
    [successor.id, predecessor.id],
  );
  if (cycle.rows[0]) {
    throw new ActivityDependencyValidationError("Activity dependencies cannot form a cycle.");
  }
}
async function touchActivity(
  transaction: Transaction,
  activityId: string,
  actorUserId: string,
): Promise<void> {
  const result = await transaction.query(
    `update "business"."activity" set "updated_at" = current_timestamp, "updated_by_user_id" = $2, "version" = "version" + 1 where "id" = $1 returning "id"`,
    [activityId, actorUserId],
  );
  if (!result.rows[0]) throw new ActivityNotFoundError(`Activity ${activityId} does not exist.`);
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
function readActivityDependency(row: Record<string, unknown>): ActivityDependency {
  return {
    id: readString(row.id, "Activity dependency id"),
    name: readString(row.name, "Activity dependency name"),
    status: readStatus(row.status),
    version: readPositiveInteger(row.version, "Activity dependency version"),
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
async function recordActivityDependencyAudit(
  transaction: Transaction,
  actorUserId: string,
  activityId: string,
  field: "predecessors" | "successors",
  added: Activity | null,
  removed: Activity | null,
): Promise<void> {
  await transaction.query(
    `insert into "business"."audit_event" ("entity_type", "entity_id", "action", "actor_user_id", "occurred_at", "changes") values ('activity', $1, 'modify', $2, current_timestamp, $3::jsonb)`,
    [
      activityId,
      actorUserId,
      JSON.stringify({
        [field]: {
          after: added ? activityDependencyAuditValue(added) : null,
          before: removed ? activityDependencyAuditValue(removed) : null,
        },
      }),
    ],
  );
}
function activityDependencyAuditValue(activity: Activity): { id: string; name: string } {
  return { id: activity.id, name: activity.name };
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
