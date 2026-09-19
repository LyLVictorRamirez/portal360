insert into "authorization"."permission" ("key", "name", "description")
values
  ('clients.read', 'Ver Clientes', 'Permite consultar el listado y detalle de Clientes.'),
  (
    'clients.manage',
    'Administrar Clientes',
    'Permite crear, editar, activar, desactivar y eliminar Clientes.'
  ),
  (
    'clients.settings.manage',
    'Configurar códigos de Clientes',
    'Permite consultar y cambiar la configuración de códigos de Cliente.'
  )
on conflict ("key") do nothing;

insert into "authorization"."role_permission" ("role_key", "permission_key")
values
  ('administrador', 'clients.read'),
  ('administrador', 'clients.manage'),
  ('administrador', 'clients.settings.manage'),
  ('lider', 'clients.read'),
  ('lider', 'clients.manage'),
  ('miembro', 'clients.read')
on conflict ("role_key", "permission_key") do nothing;

update "authorization"."role"
set "description" = case "key"
  when 'administrador' then
    'Administra roles, permisos, asignaciones, Clientes y su configuración de códigos.'
  when 'lider' then
    'Tiene acceso básico a Portal 360 y puede administrar Clientes.'
  when 'miembro' then
    'Tiene acceso básico a Portal 360 y puede consultar Clientes.'
  else "description"
end
where "key" in ('administrador', 'lider', 'miembro');
