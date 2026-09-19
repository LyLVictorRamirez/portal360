insert into "authorization"."permission" ("key", "name", "description")
values
  ('projects.read', 'Ver Proyectos', 'Permite consultar el listado y detalle de Proyectos.'),
  (
    'projects.manage',
    'Administrar Proyectos',
    'Permite crear, editar, cambiar el estado y eliminar Proyectos sin relaciones.'
  ),
  (
    'projects.settings.manage',
    'Configurar códigos de Proyectos',
    'Permite consultar y cambiar la configuración de códigos de Proyecto.'
  )
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('administrador', 'projects.read'),
  ('administrador', 'projects.manage'),
  ('administrador', 'projects.settings.manage'),
  ('lider', 'projects.read'),
  ('lider', 'projects.manage'),
  ('miembro', 'projects.read')
on conflict ("role_key", "permission_key") do nothing;
