insert into "authorization"."permission" ("key", "name", "description")
values
  (
    'activities.read',
    'Ver Actividades',
    'Permite consultar Actividades, categorías activas y su línea de tiempo.'
  ),
  (
    'activities.manage',
    'Administrar Actividades',
    'Permite crear, editar, ordenar y eliminar Actividades autorizadas.'
  ),
  (
    'activity-categories.manage',
    'Administrar categorías de Actividad',
    'Permite crear, renombrar, activar y desactivar categorías de Actividad.'
  )
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('administrador', 'activities.read'),
  ('administrador', 'activities.manage'),
  ('administrador', 'activity-categories.manage'),
  ('lider', 'activities.read'),
  ('lider', 'activities.manage'),
  ('miembro', 'activities.read'),
  ('miembro', 'activities.manage')
on conflict ("role_key", "permission_key") do nothing;
