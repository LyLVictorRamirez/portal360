insert into "authorization"."permission" ("key", "name", "description")
values
  (
    'requirements.read',
    'Ver Requerimientos',
    'Permite consultar el listado y detalle de Requerimientos.'
  ),
  (
    'requirements.manage',
    'Administrar Requerimientos',
    'Permite crear, editar, cambiar el estado y eliminar Requerimientos sin relaciones.'
  ),
  (
    'requirements.settings.manage',
    'Configurar códigos de Requerimientos',
    'Permite consultar y cambiar la configuración de códigos de Requerimiento.'
  )
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('administrador', 'requirements.read'),
  ('administrador', 'requirements.manage'),
  ('administrador', 'requirements.settings.manage'),
  ('lider', 'requirements.read'),
  ('lider', 'requirements.manage'),
  ('miembro', 'requirements.read')
on conflict ("role_key", "permission_key") do nothing;
