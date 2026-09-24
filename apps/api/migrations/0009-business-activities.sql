create table "business"."activity_category" (
  "id" uuid primary key default gen_random_uuid(),
  "name" varchar(100) not null,
  "is_active" boolean not null default true,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text references "auth"."user" ("id") on delete restrict,
  constraint "activity_category_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 100
  ),
  constraint "activity_category_version_positive_check" check ("version" > 0)
);

create unique index "activity_category_normalized_name_key"
on "business"."activity_category" (lower("name"));

create index "activity_category_active_name_idx"
on "business"."activity_category" ("is_active", "name");

create index "activity_category_created_by_user_id_idx"
on "business"."activity_category" ("created_by_user_id");

create index "activity_category_updated_by_user_id_idx"
on "business"."activity_category" ("updated_by_user_id");

insert into "business"."activity_category" ("name")
values
  ('Desarrollo'),
  ('Pruebas'),
  ('Reuniones'),
  ('Consultoría'),
  ('Documentación'),
  ('Soporte'),
  ('Estabilización')
on conflict do nothing;

create function "business"."prevent_activity_category_deletion"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Activity categories cannot be deleted.' using errcode = '23514';
end;
$$;

create trigger "activity_category_prevent_deletion"
before delete on "business"."activity_category"
for each row execute function "business"."prevent_activity_category_deletion"();

create table "business"."activity" (
  "id" uuid primary key default gen_random_uuid(),
  "project_id" uuid references "business"."project" ("id") on delete restrict,
  "requirement_id" uuid references "business"."requirement" ("id") on delete restrict,
  "ticket_id" uuid references "business"."ticket" ("id") on delete restrict,
  "project_stage_id" uuid references "business"."project_stage" ("id") on delete restrict,
  "parent_activity_id" uuid references "business"."activity" ("id") on delete restrict,
  "assigned_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "activity_category_id" uuid not null references "business"."activity_category" ("id") on delete restrict,
  "name" varchar(200) not null,
  "description" varchar(2000),
  "status" text not null default 'pending',
  "priority" text not null default 'medium',
  "estimated_hours" numeric(10, 2) not null,
  "target_date" date,
  "is_customer_deliverable" boolean not null default false,
  "customer_commitment_date" date,
  "position" integer not null,
  "blocked_reason" varchar(2000),
  "blocked_started_at" timestamptz,
  "waiting_reason" varchar(2000),
  "waiting_for" text,
  "waiting_started_at" timestamptz,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "activity_exactly_one_container_check" check (
    num_nonnulls("project_id", "requirement_id", "ticket_id") = 1
  ),
  constraint "activity_project_stage_container_check" check (
    ("project_id" is not null and "project_stage_id" is not null)
    or ("project_id" is null and "project_stage_id" is null)
  ),
  constraint "activity_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 200
  ),
  constraint "activity_description_length_check" check (
    "description" is null or char_length("description") <= 2000
  ),
  constraint "activity_status_check" check (
    "status" in (
      'pending',
      'in_progress',
      'in_review',
      'customer_testing',
      'blocked',
      'waiting_third_party',
      'finalized'
    )
  ),
  constraint "activity_priority_check" check (
    "priority" in ('critical', 'high', 'medium', 'low')
  ),
  constraint "activity_estimated_hours_positive_check" check ("estimated_hours" > 0),
  constraint "activity_customer_commitment_date_check" check (
    ("is_customer_deliverable" and "customer_commitment_date" is not null)
    or (not "is_customer_deliverable" and "customer_commitment_date" is null)
  ),
  constraint "activity_blocked_data_check" check (
    (
      "status" = 'blocked'
      and "blocked_reason" is not null
      and "blocked_reason" = btrim("blocked_reason")
      and char_length("blocked_reason") between 1 and 2000
      and "blocked_started_at" is not null
    )
    or (
      "status" <> 'blocked'
      and "blocked_reason" is null
      and "blocked_started_at" is null
    )
  ),
  constraint "activity_waiting_data_check" check (
    (
      "status" = 'waiting_third_party'
      and "waiting_reason" is not null
      and "waiting_reason" = btrim("waiting_reason")
      and char_length("waiting_reason") between 1 and 2000
      and "waiting_for" in ('client', 'provider', 'other')
      and "waiting_started_at" is not null
    )
    or (
      "status" <> 'waiting_third_party'
      and "waiting_reason" is null
      and "waiting_for" is null
      and "waiting_started_at" is null
    )
  ),
  constraint "activity_position_positive_check" check ("position" > 0),
  constraint "activity_version_positive_check" check ("version" > 0)
);

create unique index "activity_project_root_position_key"
on "business"."activity" ("project_id", "position")
where "parent_activity_id" is null and "project_id" is not null;

create unique index "activity_requirement_root_position_key"
on "business"."activity" ("requirement_id", "position")
where "parent_activity_id" is null and "requirement_id" is not null;

create unique index "activity_ticket_root_position_key"
on "business"."activity" ("ticket_id", "position")
where "parent_activity_id" is null and "ticket_id" is not null;

create unique index "activity_child_position_key"
on "business"."activity" ("parent_activity_id", "position")
where "parent_activity_id" is not null;

create index "activity_project_stage_position_idx"
on "business"."activity" ("project_id", "project_stage_id", "position");

create index "activity_requirement_id_idx"
on "business"."activity" ("requirement_id");

create index "activity_ticket_id_idx"
on "business"."activity" ("ticket_id");

create index "activity_assigned_user_id_idx"
on "business"."activity" ("assigned_user_id");

create index "activity_category_id_idx"
on "business"."activity" ("activity_category_id");

create index "activity_status_updated_at_idx"
on "business"."activity" ("status", "updated_at" desc);

create index "activity_priority_updated_at_idx"
on "business"."activity" ("priority", "updated_at" desc);

create index "activity_updated_at_idx"
on "business"."activity" ("updated_at" desc);

create index "activity_created_by_user_id_idx"
on "business"."activity" ("created_by_user_id");

create index "activity_updated_by_user_id_idx"
on "business"."activity" ("updated_by_user_id");

create function "business"."enforce_activity_hierarchy_and_stage"()
returns trigger
language plpgsql
as $$
declare
  parent_activity "business"."activity"%rowtype;
begin
  if new."project_stage_id" is not null and not exists (
    select 1
    from "business"."project_stage" as project_stage
    where project_stage."id" = new."project_stage_id"
      and project_stage."project_id" = new."project_id"
  ) then
    raise exception 'The activity stage must belong to its project.' using errcode = '23514';
  end if;

  if new."parent_activity_id" is not null then
    if new."parent_activity_id" = new."id" then
      raise exception 'An activity cannot be its own parent.' using errcode = '23514';
    end if;

    if exists (
      select 1
      from "business"."activity" as child_activity
      where child_activity."parent_activity_id" = new."id"
    ) then
      raise exception 'Activities with children cannot become child activities.'
        using errcode = '23514';
    end if;

    select *
    into parent_activity
    from "business"."activity"
    where "id" = new."parent_activity_id";

    if parent_activity."id" is null then
      raise exception 'The activity parent does not exist.' using errcode = '23514';
    end if;

    if parent_activity."parent_activity_id" is not null then
      raise exception 'Activity hierarchies support only two levels.' using errcode = '23514';
    end if;

    if parent_activity."project_id" is distinct from new."project_id"
      or parent_activity."requirement_id" is distinct from new."requirement_id"
      or parent_activity."ticket_id" is distinct from new."ticket_id"
      or parent_activity."project_stage_id" is distinct from new."project_stage_id" then
      raise exception 'Child activities must share their parent container and stage.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old."project_id" is distinct from new."project_id"
      or old."requirement_id" is distinct from new."requirement_id"
      or old."ticket_id" is distinct from new."ticket_id" then
      raise exception 'Activity containers are immutable.' using errcode = '23514';
    end if;

    if old."project_stage_id" is distinct from new."project_stage_id" and exists (
      select 1
      from "business"."activity" as child_activity
      where child_activity."parent_activity_id" = old."id"
    ) then
      raise exception 'Activities with children cannot change stage.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger "activity_enforce_hierarchy_and_stage"
before insert or update on "business"."activity"
for each row execute function "business"."enforce_activity_hierarchy_and_stage"();

create table "business"."audit_event" (
  "id" uuid primary key default gen_random_uuid(),
  "entity_type" text not null,
  "entity_id" uuid not null,
  "action" text not null,
  "actor_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "occurred_at" timestamptz not null,
  "changes" jsonb not null,
  "reason" varchar(2000),
  "context" jsonb,
  constraint "audit_event_entity_type_check" check ("entity_type" = 'activity'),
  constraint "audit_event_action_check" check ("action" in ('create', 'modify', 'delete')),
  constraint "audit_event_reason_length_check" check (
    "reason" is null or char_length("reason") <= 2000
  )
);

create index "audit_event_entity_occurred_at_idx"
on "business"."audit_event" ("entity_type", "entity_id", "occurred_at" desc);

create index "audit_event_actor_user_id_idx"
on "business"."audit_event" ("actor_user_id");

create function "business"."prevent_audit_event_mutation"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Audit events are immutable.' using errcode = '23514';
end;
$$;

create trigger "audit_event_prevent_mutation"
before update or delete on "business"."audit_event"
for each row execute function "business"."prevent_audit_event_mutation"();
