alter table "business"."entity_code_settings"
drop constraint "entity_code_settings_type_check";

alter table "business"."entity_code_settings"
add constraint "entity_code_settings_type_check" check (
  "entity_type" in ('client', 'project', 'requirement')
);

insert into "business"."entity_code_settings" (
  "entity_type",
  "prefix",
  "code_length",
  "next_sequence"
)
values ('requirement', 'REQ', 6, 1)
on conflict ("entity_type") do nothing;

create table "business"."requirement" (
  "id" uuid primary key default gen_random_uuid(),
  "client_id" uuid not null references "business"."client" ("id") on delete restrict,
  "code" varchar(21) not null unique,
  "name" varchar(200) not null,
  "description" varchar(2000),
  "status" text not null,
  "requested_on" date not null,
  "committed_on" date,
  "quoted_on" date,
  "approved_on" date,
  "approved_by_user_id" text references "auth"."user" ("id") on delete restrict,
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "requirement_name_trimmed_check" check (
    "name" = btrim("name") and char_length("name") between 1 and 200
  ),
  constraint "requirement_description_length_check" check (
    "description" is null or char_length("description") <= 2000
  ),
  constraint "requirement_optional_dates_check" check (
    ("committed_on" is null or "committed_on" >= "requested_on")
    and ("quoted_on" is null or "quoted_on" >= "requested_on")
    and ("approved_on" is null or "approved_on" >= "requested_on")
  ),
  constraint "requirement_status_check" check (
    "status" in (
      'new',
      'in_analysis',
      'quoted',
      'approved',
      'in_execution',
      'closed',
      'cancelled'
    )
  ),
  constraint "requirement_status_dates_check" check (
    (
      "status" not in ('quoted', 'approved', 'in_execution', 'closed')
      or "quoted_on" is not null
    )
    and (
      "status" not in ('approved', 'in_execution', 'closed')
      or ("approved_on" is not null and "approved_by_user_id" is not null)
    )
  ),
  constraint "requirement_version_positive_check" check ("version" > 0)
);

create index "requirement_client_id_idx" on "business"."requirement" ("client_id");
create index "requirement_status_updated_at_idx"
on "business"."requirement" ("status", "updated_at" desc);
create index "requirement_updated_at_idx" on "business"."requirement" ("updated_at" desc);
create index "requirement_created_by_user_id_idx"
on "business"."requirement" ("created_by_user_id");
create index "requirement_updated_by_user_id_idx"
on "business"."requirement" ("updated_by_user_id");
create index "requirement_approved_by_user_id_idx"
on "business"."requirement" ("approved_by_user_id");

create function "business"."prevent_requirement_identity_mutation"()
returns trigger
language plpgsql
as $$
begin
  if new."code" is distinct from old."code" then
    raise exception 'Requirement codes are immutable.' using errcode = '23514';
  end if;

  if new."client_id" is distinct from old."client_id" then
    raise exception 'Requirement clients are immutable.' using errcode = '23514';
  end if;

  if old."approved_by_user_id" is not null
    and new."approved_by_user_id" is distinct from old."approved_by_user_id" then
    raise exception 'Requirement approvers are immutable.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "requirement_prevent_identity_mutation"
before update on "business"."requirement"
for each row execute function "business"."prevent_requirement_identity_mutation"();
