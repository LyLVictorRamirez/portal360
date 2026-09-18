create schema if not exists "authorization";

create table if not exists "authorization"."schema_migration" (
  "name" text primary key,
  "applied_at" timestamptz not null default current_timestamp
);

create table "authorization"."permission" (
  "key" text primary key,
  "name" text not null,
  "description" text not null
);

create table "authorization"."role" (
  "key" text primary key,
  "name" text not null,
  "description" text not null,
  "kind" text not null,
  "is_active" boolean not null default true,
  "is_default" boolean not null default false,
  "created_at" timestamptz not null default current_timestamp,
  "updated_at" timestamptz not null default current_timestamp,
  constraint "role_kind_check" check ("kind" in ('system', 'custom')),
  constraint "role_default_check" check (("key" = 'estandar') = "is_default"),
  constraint "role_default_active_check" check (not "is_default" or "is_active")
);

create unique index "role_default_unique" on "authorization"."role" ("is_default")
where "is_default";

create index "role_active_idx" on "authorization"."role" ("key") where "is_active";

create table "authorization"."role_permission" (
  "role_key" text not null references "authorization"."role" ("key") on delete cascade,
  "permission_key" text not null references "authorization"."permission" ("key") on delete restrict,
  primary key ("role_key", "permission_key")
);

create index "role_permission_permission_key_idx"
on "authorization"."role_permission" ("permission_key");

create table "authorization"."user_role" (
  "user_id" text not null references "auth"."user" ("id") on delete restrict,
  "role_key" text not null references "authorization"."role" ("key") on delete restrict,
  "assigned_at" timestamptz not null default current_timestamp,
  "assigned_by_user_id" text references "auth"."user" ("id") on delete set null,
  primary key ("user_id", "role_key")
);

create index "user_role_role_key_idx" on "authorization"."user_role" ("role_key");

create table "authorization"."audit_event" (
  "id" bigint generated always as identity primary key,
  "occurred_at" timestamptz not null default current_timestamp,
  "event_type" text not null,
  "actor_user_id" text references "auth"."user" ("id") on delete set null,
  "subject_type" text not null,
  "subject_key" text not null,
  "before_state" jsonb,
  "after_state" jsonb,
  constraint "audit_event_state_change_check" check (
    "before_state" is distinct from "after_state"
  )
);

create index "audit_event_occurred_at_idx" on "authorization"."audit_event" ("occurred_at" desc);

create index "audit_event_actor_user_id_idx" on "authorization"."audit_event" ("actor_user_id");

create function "authorization"."prevent_audit_event_mutation"()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Authorization audit events are immutable.';
end;
$$;

create trigger "audit_event_prevent_mutation"
before update or delete on "authorization"."audit_event"
for each row execute function "authorization"."prevent_audit_event_mutation"();

create function "authorization"."enforce_role_lifecycle"()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old."kind" = 'system' then
    raise exception 'System roles cannot be deleted.';
  end if;

  if tg_op = 'UPDATE' then
    if new."key" is distinct from old."key" then
      raise exception 'Role keys are immutable.';
    end if;

    if new."kind" is distinct from old."kind" then
      raise exception 'Role kinds are immutable.';
    end if;

    if old."kind" = 'system' and not new."is_active" then
      raise exception 'System roles cannot be deactivated.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger "role_enforce_lifecycle"
before update or delete on "authorization"."role"
for each row execute function "authorization"."enforce_role_lifecycle"();

create function "authorization"."ensure_standard_access"()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from "authorization"."role_permission"
    where "role_key" = 'estandar' and "permission_key" = 'app.access'
  ) then
    raise exception 'The standard role must retain app.access.';
  end if;

  return null;
end;
$$;

create constraint trigger "role_permission_requires_standard_access"
after delete or update of "role_key", "permission_key" on "authorization"."role_permission"
deferrable initially immediate
for each row execute function "authorization"."ensure_standard_access"();

insert into "authorization"."permission" ("key", "name", "description")
values
  ('app.access', 'Acceso a Portal 360', 'Permite acceder a la aplicación privada.'),
  ('authorization.users.read', 'Ver usuarios', 'Permite consultar las cuentas y sus roles.'),
  ('authorization.users.manage', 'Administrar roles de usuarios', 'Permite asignar y retirar roles.'),
  ('authorization.roles.read', 'Ver roles', 'Permite consultar roles y sus permisos.'),
  ('authorization.roles.manage', 'Administrar roles', 'Permite crear, editar y administrar roles.')
on conflict ("key") do nothing;

insert into "authorization"."role" (
  "key",
  "name",
  "description",
  "kind",
  "is_active",
  "is_default"
)
values
  (
    'administrador',
    'Administrador',
    'Administra los roles, los permisos y las asignaciones de Portal 360.',
    'system',
    true,
    false
  ),
  ('lider', 'Líder', 'Tiene acceso básico a Portal 360.', 'system', true, false),
  ('miembro', 'Miembro', 'Tiene acceso básico a Portal 360.', 'system', true, false),
  ('estandar', 'Estándar', 'Rol mínimo de acceso para registros públicos.', 'system', true, true)
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
select 'administrador', "key"
from "authorization"."permission"
on conflict do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('lider', 'app.access'),
  ('miembro', 'app.access'),
  ('estandar', 'app.access')
on conflict do nothing;
