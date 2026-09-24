create table "business"."activity_dependency" (
  "predecessor_activity_id" uuid not null
    references "business"."activity" ("id") on delete restrict,
  "successor_activity_id" uuid not null
    references "business"."activity" ("id") on delete restrict,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null
    references "auth"."user" ("id") on delete restrict,
  primary key ("predecessor_activity_id", "successor_activity_id"),
  constraint "activity_dependency_distinct_activities_check" check (
    "predecessor_activity_id" <> "successor_activity_id"
  )
);

create index "activity_dependency_successor_activity_id_idx"
on "business"."activity_dependency" ("successor_activity_id");

create index "activity_dependency_created_by_user_id_idx"
on "business"."activity_dependency" ("created_by_user_id");

create function "business"."enforce_activity_dependency_integrity"()
returns trigger
language plpgsql
as $$
declare
  predecessor_activity "business"."activity"%rowtype;
  successor_activity "business"."activity"%rowtype;
begin
  -- Serializing dependency inserts also prevents two concurrent inverse edges from
  -- independently passing the recursive cycle check.
  perform pg_advisory_xact_lock(360014);

  select *
  into predecessor_activity
  from "business"."activity"
  where "id" = new."predecessor_activity_id";

  select *
  into successor_activity
  from "business"."activity"
  where "id" = new."successor_activity_id";

  if predecessor_activity."id" is null or successor_activity."id" is null then
    raise exception 'An activity dependency requires existing activities.' using errcode = '23503';
  end if;

  if predecessor_activity."project_id" is distinct from successor_activity."project_id"
    or predecessor_activity."requirement_id" is distinct from successor_activity."requirement_id"
    or predecessor_activity."ticket_id" is distinct from successor_activity."ticket_id" then
    raise exception 'Activity dependencies must use the same container.' using errcode = '23514';
  end if;

  if exists (
    with recursive descendants("activity_id") as (
      select new."successor_activity_id"
      union
      select dependency."successor_activity_id"
      from "business"."activity_dependency" as dependency
      join descendants on dependency."predecessor_activity_id" = descendants."activity_id"
    )
    select 1
    from descendants
    where "activity_id" = new."predecessor_activity_id"
  ) then
    raise exception 'Activity dependencies cannot form a cycle.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "activity_dependency_enforce_integrity"
before insert on "business"."activity_dependency"
for each row execute function "business"."enforce_activity_dependency_integrity"();
