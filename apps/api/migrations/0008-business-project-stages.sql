create table "business"."project_stage" (
  "id" uuid primary key default gen_random_uuid(),
  "project_id" uuid not null references "business"."project" ("id") on delete restrict,
  "name" varchar(15) not null,
  "position" integer not null,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "project_stage_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 15
  ),
  constraint "project_stage_position_positive_check" check ("position" > 0),
  constraint "project_stage_version_positive_check" check ("version" > 0),
  constraint "project_stage_project_id_position_key" unique ("project_id", "position")
);

create unique index "project_stage_project_id_normalized_name_key"
on "business"."project_stage" ("project_id", lower("name"));

create index "project_stage_project_id_position_idx"
on "business"."project_stage" ("project_id", "position");

create index "project_stage_created_by_user_id_idx"
on "business"."project_stage" ("created_by_user_id");

create index "project_stage_updated_by_user_id_idx"
on "business"."project_stage" ("updated_by_user_id");
