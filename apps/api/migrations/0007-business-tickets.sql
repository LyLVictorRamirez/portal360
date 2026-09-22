create table "business"."ticket" (
  "id" uuid primary key default gen_random_uuid(),
  "client_id" uuid not null references "business"."client" ("id") on delete restrict,
  "external_reference" varchar(200) not null,
  "external_url" varchar(2048),
  "title" varchar(200) not null,
  "description" varchar(2000),
  "external_priority" text not null default 'medium',
  "version" integer not null default 1,
  "created_at" timestamptz not null default current_timestamp,
  "created_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  "updated_at" timestamptz not null default current_timestamp,
  "updated_by_user_id" text not null references "auth"."user" ("id") on delete restrict,
  constraint "ticket_external_reference_trimmed_check" check (
    "external_reference" = btrim("external_reference")
    and char_length("external_reference") between 1 and 200
  ),
  constraint "ticket_external_url_format_check" check (
    "external_url" is null or "external_url" ~* '^https?://.+'
  ),
  constraint "ticket_title_trimmed_check" check (
    "title" = btrim("title") and char_length("title") between 1 and 200
  ),
  constraint "ticket_description_length_check" check (
    "description" is null or char_length("description") <= 2000
  ),
  constraint "ticket_external_priority_check" check (
    "external_priority" in ('critical', 'high', 'medium', 'low')
  ),
  constraint "ticket_version_positive_check" check ("version" > 0)
);

create index "ticket_client_id_idx" on "business"."ticket" ("client_id");
create index "ticket_external_priority_updated_at_idx"
on "business"."ticket" ("external_priority", "updated_at" desc);
create index "ticket_updated_at_idx" on "business"."ticket" ("updated_at" desc);
create index "ticket_created_by_user_id_idx"
on "business"."ticket" ("created_by_user_id");
create index "ticket_updated_by_user_id_idx"
on "business"."ticket" ("updated_by_user_id");

create function "business"."prevent_ticket_client_mutation"()
returns trigger
language plpgsql
as $$
begin
  if new."client_id" is distinct from old."client_id" then
    raise exception 'Ticket clients are immutable.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger "ticket_prevent_client_mutation"
before update on "business"."ticket"
for each row execute function "business"."prevent_ticket_client_mutation"();
