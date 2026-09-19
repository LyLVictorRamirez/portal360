create table "business"."entity_code_settings" (
  "entity_type" text primary key,
  "prefix" varchar(10) not null,
  "code_length" smallint not null,
  "next_sequence" bigint not null,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text references "auth"."user" ("id") on delete restrict,
  constraint "entity_code_settings_type_check" check ("entity_type" in ('client', 'project')),
  constraint "entity_code_settings_prefix_format_check" check (
    "prefix" ~ '^[A-Z0-9]{1,10}$'
  ),
  constraint "entity_code_settings_code_length_check" check (
    "code_length" between 3 and 20 and char_length("prefix") < "code_length"
  ),
  constraint "entity_code_settings_next_sequence_check" check ("next_sequence" > 0),
  constraint "entity_code_settings_version_positive_check" check ("version" > 0)
);

insert into "business"."entity_code_settings" (
  "entity_type",
  "prefix",
  "code_length",
  "next_sequence",
  "version",
  "created_at",
  "created_by_user_id",
  "updated_at",
  "updated_by_user_id"
)
select
  'client',
  "prefix",
  "code_length",
  "next_sequence",
  "version",
  "created_at",
  "created_by_user_id",
  "updated_at",
  "updated_by_user_id"
from "business"."client_code_settings";

insert into "business"."entity_code_settings" (
  "entity_type",
  "prefix",
  "code_length",
  "next_sequence"
)
values ('project', 'PRY', 6, 1);

drop table "business"."client_code_settings";
drop function "business"."enforce_client_code_settings_lifecycle"();

create function "business"."enforce_entity_code_settings_lifecycle"()
returns trigger
language plpgsql
as $$
begin
  if new."entity_type" is distinct from old."entity_type" then
    raise exception 'The code settings entity type is immutable.' using errcode = '23514';
  end if;

  if new."next_sequence" < old."next_sequence" then
    raise exception 'The next entity sequence cannot be reduced.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "entity_code_settings_enforce_lifecycle"
before update on "business"."entity_code_settings"
for each row execute function "business"."enforce_entity_code_settings_lifecycle"();

create index "entity_code_settings_created_by_user_id_idx"
on "business"."entity_code_settings" ("created_by_user_id");

create index "entity_code_settings_updated_by_user_id_idx"
on "business"."entity_code_settings" ("updated_by_user_id");

create table "business"."project" (
  "id" uuid primary key default gen_random_uuid(),
  "client_id" uuid not null references "business"."client" ("id") on delete restrict,
  "code" varchar(21) not null unique,
  "name" varchar(200) not null,
  "description" varchar(2000),
  "start_date" date not null,
  "committed_end_date" date not null,
  "status" text not null,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "project_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 200
  ),
  constraint "project_description_length_check" check (
    "description" is null or char_length("description") <= 2000
  ),
  constraint "project_committed_end_date_check" check (
    "committed_end_date" >= "start_date"
  ),
  constraint "project_status_check" check (
    "status" in ('planned', 'active', 'paused', 'finalized', 'cancelled')
  ),
  constraint "project_version_positive_check" check ("version" > 0)
);

create index "project_client_id_idx" on "business"."project" ("client_id");
create index "project_status_updated_at_idx" on "business"."project" ("status", "updated_at" desc);
create index "project_updated_at_idx" on "business"."project" ("updated_at" desc);
create index "project_created_by_user_id_idx" on "business"."project" ("created_by_user_id");
create index "project_updated_by_user_id_idx" on "business"."project" ("updated_by_user_id");

create function "business"."prevent_project_identity_mutation"()
returns trigger
language plpgsql
as $$
begin
  if new."code" is distinct from old."code" then
    raise exception 'Project codes are immutable.' using errcode = '23514';
  end if;

  if new."client_id" is distinct from old."client_id" then
    raise exception 'Project clients are immutable.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "project_prevent_identity_mutation"
before update on "business"."project"
for each row execute function "business"."prevent_project_identity_mutation"();
