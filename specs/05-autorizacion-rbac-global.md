# SPEC 05 — Autorización RBAC global parametrizable

> **Status:** Aprobada
> **Depends on:** SPEC 03, SPEC 04
> **Date:** 2026-09-18
> **Objective:** Implementar una autorización RBAC global y parametrizable que asigne múltiples roles a cada persona y controle la administración de usuarios y roles sin sustituir Better Auth.

## Por qué existe esta spec

SPEC 04 identifica y autentica a las personas, pero no define qué pueden hacer dentro de Portal 360.

Portal 360 necesita una base de autorización que conserve el principio de mínimo privilegio y que pueda crecer con los módulos de negocio sin acoplar sus reglas a Better Auth.

## Scope

**In:**

- Crear un modelo RBAC global, persistido en PostgreSQL bajo el esquema `authorization`, separado de las tablas `auth` administradas por Better Auth.
- Mantener un catálogo fijo y versionado de permisos, y permitir que los Administradores creen y administren roles que combinen esos permisos.
- Sembrar los roles de sistema `Administrador`, `Líder`, `Miembro` y `Estándar` como datos de base de datos.
- Asignar automáticamente el rol `Estándar` a cada cuenta creada mediante registro público y conservar siempre el permiso `app.access` en ese rol.
- Permitir que cada persona acumule múltiples roles y calcular sus permisos efectivos como la unión de los permisos concedidos por sus roles activos.
- Incluir un comando operativo e idempotente para promover una cuenta existente y verificada al rol `Administrador` inicial.
- Resolver los permisos contra la base de datos en cada solicitud protegida, sin guardar claims de autorización en la sesión de Better Auth.
- Crear guards, decoradores y contratos de NestJS para proteger los endpoints de autorización y dejar `GET /` como endpoint de salud público.
- Exponer endpoints privados bajo `/api/authorization/*` y reenviarlos desde `apps/web` mediante una reescritura de Next.js del mismo origen.
- Añadir las rutas privadas `/administracion/usuarios` y `/administracion/roles` con navegación condicionada por permiso.
- Permitir listar y buscar cuentas, incluidas las que aún no verifican su correo, y asignar o retirar roles sin crear, eliminar, bloquear ni cambiar credenciales de cuentas.
- Permitir crear, editar, activar, desactivar y eliminar roles `custom`; un rol personalizado solo se elimina cuando no tiene personas asignadas.
- Mantener una bitácora inmutable en base de datos de cambios de roles, permisos y asignaciones, incluyendo estado anterior y posterior, sin interfaz ni endpoint de consulta.
- Responder `401` cuando no exista sesión, `403` cuando falte un permiso, ocultar acciones de navegación no permitidas y mostrar el estado visual de acceso no autorizado al abrir una ruta protegida directamente.
- Añadir pruebas focalizadas de migración, permisos, asignaciones, protecciones HTTP y estados de interfaz.

**Out of scope (for future specs):**

- Permisos por Cliente, Proyecto, Equipo, propiedad de un registro, responsabilidad individual o cualquier otro alcance de dominio.
- Permisos definidos libremente desde la interfaz o un constructor visual de políticas.
- Microsoft Entra ID, SSO, proveedores sociales y mapeo de grupos externos a roles.
- Invitaciones, alta corporativa, bloqueo, eliminación, perfiles, cambio de credenciales o gestión completa del ciclo de vida de cuentas.
- Uso de los plugins `admin` u `organization` de Better Auth para roles y permisos.
- Auditoría general de negocio, pantalla de auditoría, exportación, alertas, retención o consulta de la bitácora de autorización.
- Autorización de módulos de negocio que todavía no existen.

## Modelo de datos y configuración

Better Auth continúa siendo la fuente de identidad, credenciales y sesiones en el esquema `auth`.

La autorización se implementará con tablas propias en el esquema `authorization` y referencias a `auth.user(id)`.

| Tabla | Campos principales | Regla |
| --- | --- | --- |
| `authorization.permission` | `key`, `name`, `description` | Catálogo fijo sembrado por migración; no tiene CRUD público. |
| `authorization.role` | `key`, `name`, `description`, `kind`, `is_active`, `is_default`, `created_at`, `updated_at` | `key` es inmutable y único; `kind` acepta `system` o `custom`. |
| `authorization.role_permission` | `role_key`, `permission_key` | Relación muchos a muchos entre roles y permisos. |
| `authorization.user_role` | `user_id`, `role_key`, `assigned_at`, `assigned_by_user_id` | Una persona puede tener varios roles; la pareja usuario–rol es única. |
| `authorization.audit_event` | `id`, `occurred_at`, `event_type`, `actor_user_id`, `subject_type`, `subject_key`, `before_state`, `after_state` | Solo inserciones; conserva el cambio completo y no se expone por HTTP en esta spec. |
| `authorization.schema_migration` | `name`, `applied_at` | Registra las migraciones SQL propias ejecutadas por el comando de autorización. |

La migración de autorización creará los datos iniciales siguientes:

| Rol | `key` | `kind` | `is_default` | Permisos iniciales |
| --- | --- | --- | --- | --- |
| Administrador | `administrador` | `system` | `false` | Todos los permisos del catálogo. |
| Líder | `lider` | `system` | `false` | `app.access`. |
| Miembro | `miembro` | `system` | `false` | `app.access`. |
| Estándar | `estandar` | `system` | `true` | `app.access`, obligatorio e inalterable en su asignación. |

El catálogo inicial de `authorization.permission` contiene exactamente estas claves:

```text
app.access
authorization.users.read
authorization.users.manage
authorization.roles.read
authorization.roles.manage
```

Las reglas de integridad son las siguientes:

- Solo existe un rol con `is_default = true`; será `estandar`.
- Los roles `system` no se eliminan ni se desactivan.
- Los roles `system` pueden cambiar nombre visible, descripción y asociaciones de permisos, salvo la asociación obligatoria entre `estandar` y `app.access`.
- Los roles `custom` pueden editarse, activarse o desactivarse; solo se eliminan si no hay filas en `authorization.user_role` que los asignen.
- Ninguna mutación puede dejar sin una persona activa el permiso efectivo `authorization.roles.manage`.
- Ninguna mutación puede retirar el último rol activo de una persona.
- Los permisos efectivos son la unión de los permisos de todos los roles activos de esa persona; no existen reglas de denegación explícita.

El comando `authorization:bootstrap-admin` recibirá un correo como argumento y solo promoverá a una cuenta existente y con correo verificado.

Será idempotente, registrará un evento de auditoría de arranque y no introducirá una variable de entorno ni una elevación automática para la primera cuenta registrada.

Las operaciones administrativas escriben `before_state` y `after_state` estructurados en la misma transacción que cambia roles, permisos o asignaciones.

## Plan de implementación

1. Añadir a `apps/api/package.json` el script `authorization:migrate` y crear el ejecutor de migraciones con `pg` para registrar de forma transaccional las migraciones propias en `authorization.schema_migration`; comprobar que el comando se puede ejecutar después de `auth:migrate` sin modificar el esquema `auth`.
2. Crear `apps/api/migrations/0002-authorization-rbac.sql` con el esquema `authorization`, sus claves foráneas, índices, restricciones de integridad, catálogo de permisos y roles de sistema; comprobar que la migración es repetible mediante el registro de migraciones y que `estandar` conserva `app.access`.
3. Crear el módulo `apps/api/src/authorization/` con tipos, catálogo de permisos, acceso a datos y servicio que resuelva los roles y permisos efectivos de un usuario mediante consultas actuales a PostgreSQL; comprobar con pruebas unitarias la unión de permisos de varios roles.
4. Conectar el alta de usuario de Better Auth con la asignación idempotente del rol por defecto `estandar` y crear el ejecutor `apps/api/src/authorization/bootstrap-admin.ts`; comprobar que un registro recibe el rol mínimo y que el comando rechaza correos inexistentes o no verificados.
5. Implementar el contexto de autorización de NestJS, el decorador de permisos y el guard reutilizable en `apps/api/src/authorization/`; comprobar que una solicitud sin sesión recibe `401`, una sesión sin permiso recibe `403` y el endpoint de salud sigue público.
6. Crear `GET /api/authorization/me` para devolver los roles y permisos efectivos de la sesión verificada; comprobar que un cambio de asignación se observa en la siguiente solicitud sin renovar la sesión.
7. Crear los endpoints de usuarios bajo `/api/authorization/users` para listar y buscar cuentas, mostrar su estado de verificación y reemplazar sus asignaciones de roles; comprobar que las cuentas sin verificar se pueden preparar pero no acceden a la aplicación hasta completar la verificación.
8. Crear los endpoints de roles bajo `/api/authorization/roles` para listar roles, crear y editar roles `custom`, administrar asociaciones con el catálogo fijo y activar, desactivar o eliminar roles dentro de las restricciones definidas; comprobar que un rol `system`, el último administrador o el último rol de una persona no se pueden dejar en un estado inválido.
9. Registrar eventos de auditoría de creación, edición, activación, desactivación, eliminación, asignación y retirada de roles o permisos, incluidos los estados anterior y posterior; comprobar que una mutación fallida no produce un evento y que no se crea ningún endpoint de lectura de auditoría.
10. Registrar el módulo y controlador de autorización en `apps/api/src/app.module.ts`, y extender `apps/web/next.config.ts` para reenviar solo `/api/authorization/:path*` al origen de `apps/api`; comprobar que las cookies de Better Auth se reenvían sin exponer secretos al navegador.
11. Crear utilidades tipadas de autorización en `apps/web/src/lib/` para consultar el contexto actual con la cookie del servidor y adaptar `apps/web/src/app/(app)/layout.tsx` para exigir `app.access`; comprobar que falta de sesión redirige al Login y que una sesión sin ese permiso recibe el estado visual `UnauthorizedState`.
12. Actualizar `apps/web/src/components/layout/application-shell.tsx` y `apps/web/src/components/layout/app-sidebar.tsx` para recibir los permisos efectivos y mostrar "Administración" solo a quien tenga el permiso de lectura o gestión correspondiente; comprobar navegación de escritorio y móvil, y ocultamiento de opciones no autorizadas.
13. Crear `apps/web/src/app/(app)/administracion/usuarios/page.tsx` y sus componentes de gestión para buscar cuentas, mostrar nombre, correo, verificación y roles, y asignar o retirar roles mediante `/api/authorization/users`; comprobar mensajes de carga, error, vacío y `403` con los componentes visuales de SPEC 03.
14. Crear `apps/web/src/app/(app)/administracion/roles/page.tsx` y sus componentes para listar los roles de sistema y personalizados, editar la información permitida, administrar permisos del catálogo fijo y aplicar el ciclo de vida de los roles `custom`; comprobar que la interfaz comunica las restricciones de roles de sistema y no ofrece funciones de auditoría.
15. Añadir pruebas focalizadas de la migración, el rol inicial, el bootstrap, las restricciones de integridad, la unión de permisos, los guards, los contratos `401` y `403`, los endpoints administrativos, la navegación condicional y los estados de acceso; comprobar los comandos de validación del monorepo.

## Criterios de aceptación

- [ ] Ejecutar `corepack pnpm --filter @portal-360/api auth:migrate` y `corepack pnpm --filter @portal-360/api authorization:migrate` crea los esquemas esperados sin que las tablas de Better Auth reciban columnas o roles propios.
- [ ] El esquema `authorization` contiene las tablas `permission`, `role`, `role_permission`, `user_role`, `audit_event` y `schema_migration` con sus claves, índices y restricciones declaradas.
- [ ] El catálogo contiene exactamente `app.access`, `authorization.users.read`, `authorization.users.manage`, `authorization.roles.read` y `authorization.roles.manage`.
- [ ] `Administrador`, `Líder`, `Miembro` y `Estándar` existen como roles `system` persistidos; `Estándar` es el único rol predeterminado y mantiene `app.access`.
- [ ] Una cuenta registrada recibe `Estándar` de forma idempotente y no puede acceder a rutas privadas hasta verificar su correo.
- [ ] `authorization:bootstrap-admin` promueve solo una cuenta existente y verificada, es idempotente y deja una entrada de auditoría.
- [ ] Una persona con dos o más roles obtiene la unión de sus permisos activos y no puede recibir una denegación explícita por otro rol.
- [ ] La autorización se recalcula contra PostgreSQL en cada solicitud protegida; retirar un permiso afecta la siguiente solicitud sin esperar al vencimiento de la sesión.
- [ ] Una petición sin sesión recibe `401` y una sesión que no satisface el permiso requerido recibe `403` sin filtrar datos protegidos.
- [ ] `GET /` sigue siendo público y `GET /api/authorization/me` solo devuelve roles y permisos de una sesión verificada con `app.access`.
- [ ] Solo quien dispone de los permisos correspondientes puede listar usuarios, modificar asignaciones, administrar roles o cambiar permisos de roles.
- [ ] La lista de usuarios muestra cuentas verificadas y pendientes, y permite preasignar roles a las pendientes sin habilitarles el acceso antes de verificar el correo.
- [ ] Los roles `system` no se pueden eliminar ni desactivar, `estandar` no puede perder `app.access`, y un rol `custom` asignado no se puede eliminar.
- [ ] Ninguna operación deja sin personas con `authorization.roles.manage` ni retira el último rol activo de una persona.
- [ ] Cada mutación exitosa de roles, permisos o asignaciones crea en `authorization.audit_event` el actor, el objetivo y sus estados anterior y posterior; ninguna mutación fallida crea un evento.
- [ ] La aplicación no muestra ni expone por HTTP una vista, enlace, exportación o endpoint de consulta de auditoría.
- [ ] `/administracion/usuarios` y `/administracion/roles` solo aparecen en la navegación de quien tenga permiso y una visita directa sin permiso muestra `UnauthorizedState`.
- [ ] El navegador consume únicamente `/api/authorization/*` para la administración y Next.js lo reenvía a `apps/api` en el mismo origen.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** RBAC global; responde a la autorización actual sin inventar todavía entidades de Cliente, Proyecto, Equipo o propiedad de datos.
- **Sí:** varios roles por persona y unión de permisos; permite acumular responsabilidades sin una jerarquía de denegación difícil de explicar.
- **No:** denegaciones explícitas; crean conflictos de precedencia que no aportan valor al alcance inicial.
- **Sí:** permisos fijos y versionados; los endpoints pueden exigir claves conocidas y los roles se mantienen configurables.
- **No:** permisos arbitrarios creados desde la interfaz; no podrían proteger una acción que el backend no conoce.
- **Sí:** tablas propias en `authorization`; mantiene a Better Auth como dueño exclusivo de identidad, credenciales y sesiones en `auth`.
- **No:** plugin `admin` de Better Auth; sus roles y permisos se configuran en código y no ofrecen el ciclo de vida persistente requerido para roles parametrizables.
- **No:** plugin `organization` de Better Auth; sus roles dinámicos requieren una organización activa y no representan RBAC global.
- **Sí:** roles de sistema persistidos con `kind = system` y roles nuevos con `kind = custom`; permite parametrización controlada y protege el mínimo operativo inicial.
- **Sí:** `Estándar` como rol de registro; establece el mínimo privilegio y conserva siempre `app.access`.
- **Sí:** comando explícito para el primer Administrador; evita que una primera cuenta pública obtenga privilegios elevados automáticamente.
- **Sí:** consultas de autorización actuales en cada solicitud; los cambios de roles se aplican de inmediato sin duplicar permisos dentro de cookies o sesiones.
- **Sí:** auditoría inmutable solo en base de datos; conserva trazabilidad de cambios sensibles sin ampliar esta entrega con una interfaz de auditoría.
- **No:** crear, bloquear o eliminar cuentas desde Administración; la entrega administra autorización, no el ciclo de vida completo de identidad.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una instalación no ejecuta la migración de autorización después de la de Better Auth. | El ejecutor registra versiones, valida las tablas requeridas y el procedimiento de despliegue exige ejecutar ambos comandos en orden. |
| El registro crea una cuenta sin el rol predeterminado por un fallo de integración. | Asignar el rol mediante un flujo idempotente, cubrirlo con pruebas y dejar la cuenta sin acceso privado mientras no tenga `app.access`. |
| Un cambio administrativo bloquea a todos los administradores. | Rechazar en transacción los cambios que dejen sin una persona con `authorization.roles.manage`. |
| Un Administrador amplía accidentalmente los privilegios del rol Estándar. | Conservar obligatoriamente `app.access`, auditar el cambio y comunicar que los permisos de roles de sistema modifican el acceso de las cuentas presentes y futuras. |
| La consulta de permisos en cada solicitud añade carga a PostgreSQL. | Añadir índices a las relaciones de asignación y permisos; no introducir caché hasta contar con mediciones reales. |
| La bitácora crece sin una política de retención. | Mantenerla fuera de interfaz en esta fase y definir retención, exportación o alertas en una spec de auditoría posterior. |

## Qué **no** está en esta spec

- Permisos por Cliente, Proyecto, Equipo, propiedad, responsabilidad o cualquier recurso de negocio.
- Permisos arbitrarios, reglas de denegación, jerarquías complejas o políticas visuales configurables.
- Plugins de autorización de Better Auth, Microsoft Entra ID, SSO, proveedores externos o mapeo de grupos.
- Invitaciones, perfiles, bloqueo, eliminación o administración completa de cuentas.
- Interfaz, navegación, endpoint, exportación o retención de auditoría.
- Módulos de negocio todavía inexistentes.
