insert into "authorization"."permission" ("key", "name", "description")
values
  (
    'tickets.read',
    'Ver Tickets',
    'Permite consultar el listado y detalle de Tickets.'
  ),
  (
    'tickets.manage',
    'Administrar Tickets',
    'Permite crear, editar y eliminar Tickets sin Actividades relacionadas.'
  )
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('administrador', 'tickets.read'),
  ('administrador', 'tickets.manage'),
  ('lider', 'tickets.read'),
  ('lider', 'tickets.manage'),
  ('miembro', 'tickets.read')
on conflict ("role_key", "permission_key") do nothing;
