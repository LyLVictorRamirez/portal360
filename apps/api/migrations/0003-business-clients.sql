create extension if not exists pgcrypto;

create schema if not exists "business";

create table "business"."client" (
  "id" uuid primary key default gen_random_uuid(),
  "code" varchar(21) not null unique,
  "name" varchar(200) not null,
  "is_active" boolean not null default true,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "client_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 200
  ),
  constraint "client_version_positive_check" check ("version" > 0)
);

create index "client_active_name_idx" on "business"."client" ("is_active", "name");
create index "client_created_by_user_id_idx" on "business"."client" ("created_by_user_id");
create index "client_updated_by_user_id_idx" on "business"."client" ("updated_by_user_id");

create function "business"."prevent_client_code_mutation"()
returns trigger
language plpgsql
as $$
begin
  if new."code" is distinct from old."code" then
    raise exception 'Client codes are immutable.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "client_prevent_code_mutation"
before update on "business"."client"
for each row execute function "business"."prevent_client_code_mutation"();

create table "business"."client_code_settings" (
  "id" boolean primary key default true,
  "prefix" varchar(10) not null,
  "code_length" smallint not null,
  "next_sequence" bigint not null,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text references "auth"."user" ("id") on delete restrict,
  constraint "client_code_settings_single_row_check" check ("id"),
  constraint "client_code_settings_prefix_format_check" check (
    "prefix" ~ '^[A-Z0-9]{1,10}$'
  ),
  constraint "client_code_settings_code_length_check" check (
    "code_length" between 3 and 20 and char_length("prefix") < "code_length"
  ),
  constraint "client_code_settings_next_sequence_check" check ("next_sequence" > 0),
  constraint "client_code_settings_version_positive_check" check ("version" > 0)
);

create index "client_code_settings_created_by_user_id_idx"
on "business"."client_code_settings" ("created_by_user_id");

create index "client_code_settings_updated_by_user_id_idx"
on "business"."client_code_settings" ("updated_by_user_id");

create function "business"."enforce_client_code_settings_lifecycle"()
returns trigger
language plpgsql
as $$
begin
  if new."id" is distinct from old."id" then
    raise exception 'The client code settings identifier is immutable.' using errcode = '23514';
  end if;

  if new."next_sequence" < old."next_sequence" then
    raise exception 'The next client sequence cannot be reduced.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "client_code_settings_enforce_lifecycle"
before update on "business"."client_code_settings"
for each row execute function "business"."enforce_client_code_settings_lifecycle"();

insert into "business"."client_code_settings" (
  "id",
  "prefix",
  "code_length",
  "next_sequence"
)
values (true, 'CLI', 6, 1)
on conflict ("id") do nothing;
