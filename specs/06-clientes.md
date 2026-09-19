# SPEC 06 — Entidad de clientes

> **Status:** Aprobada
> **Depends on:** SPEC 03, SPEC 04, SPEC 05
> **Date:** 2026-09-18
> **Objective:** Incorporar Clientes como entidad de negocio con código generado configurable, administración autorizada y trazabilidad técnica para los futuros módulos de trabajo.

## Por qué existe esta spec

Los Proyectos, Requerimientos y Tickets del modelo de negocio pertenecen a un Cliente.

Portal 360 necesita gestionar primero ese catálogo sin adelantar todavía los módulos que crearán sus relaciones.

## Scope

**In:**

- Crear el esquema PostgreSQL `business` y su ejecutor de migraciones, separado de `auth` y `authorization`.
- Persistir Cliente con UUID como clave primaria de todas sus relaciones futuras, código único generado por la aplicación, nombre, estado, versión y trazabilidad de creación y actualización.
- Crear una configuración única de código de Cliente con prefijo, longitud alfanumérica y siguiente consecutivo.
- Inicializar la configuración con prefijo `CLI`, longitud alfanumérica de seis caracteres y consecutivo `1`, para que el primer Cliente generado tenga el código `CLI-001`.
- Permitir a quien tenga `clients.settings.manage` modificar la configuración para los próximos códigos, sin modificar los ya emitidos.
- Permitir a quien tenga `clients.read` listar y buscar Clientes por código o nombre, con paginación de 25 resultados y filtro Activo, Inactivo o Todos.
- Permitir a quien tenga `clients.manage` crear, consultar, editar, activar, desactivar y eliminar de forma definitiva Clientes sin relaciones.
- Exigir concurrencia optimista basada en versión para editar el Cliente y la configuración de código.
- Incorporar los permisos `clients.read`, `clients.manage` y `clients.settings.manage` al catálogo RBAC.
- Asignar inicialmente lectura y gestión de Clientes a `Administrador` y `Líder`, lectura a `Miembro`, y configuración de códigos solo a `Administrador`.
- Exponer la API bajo `/api/clients/*` y reenviarla desde Next.js en el mismo origen.
- Crear la ruta privada `/clientes`, su navegación condicionada por permiso y una ruta administrativa para la configuración de códigos de Cliente.
- Usar los componentes, estados y requisitos de accesibilidad definidos en SPEC 03.
- Añadir pruebas focalizadas de migración, generación de código, restricciones, autorización, API y pantallas.

**Out of scope (for future specs):**

- Número de identificación, razón social, contactos, segmentación, capacidades CRM, direcciones, teléfonos, correos o cualquier otro dato de Cliente.
- Clasificación, marca, protección o proceso especial para el Cliente interno.
- Proyectos, Requerimientos, Tickets, Etapas, Actividades y cualquier relación de negocio de Cliente.
- Permisos por Cliente, propiedad de Clientes, equipos o visibilidad restringida por registro.
- Restauración de Clientes eliminados, borrado lógico de Clientes o una bitácora histórica general de negocio.
- Configuración de códigos de entidades distintas a Cliente, un motor genérico de numeración o edición manual de códigos emitidos.

## Modelo de datos y configuración

La identidad de los actores sigue perteneciendo a `auth.user` y la autorización a `authorization`.

Los datos de negocio de esta entrega se almacenan en el esquema `business`.

| Tabla | Campos principales | Reglas |
| --- | --- | --- |
| `business.client` | `id`, `code`, `name`, `is_active`, `version`, `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id` | `id` es UUID y clave primaria; `code` es único e inmutable; `name` admite duplicados; `version` controla concurrencia. |
| `business.client_code_settings` | `id`, `prefix`, `code_length`, `next_sequence`, `version`, `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id` | Solo existe una fila con `id = true`; controla los futuros códigos y no reescribe códigos existentes. |
| `business.schema_migration` | `name`, `applied_at` | Registra las migraciones propias aplicadas por `business:migrate`. |

`business.client.id` será `uuid` con valor generado por PostgreSQL mediante `gen_random_uuid()`.

Las futuras tablas que relacionen un Cliente guardarán `client_id uuid not null references business.client(id) on delete restrict`.

Los campos `created_by_user_id` y `updated_by_user_id` serán `text not null references auth.user(id) on delete restrict`.

El nombre se almacenará en `varchar(200)`, será obligatorio después de eliminar espacios externos y podrá repetirse.

El estado será `is_active boolean not null default true`.

`version` será un entero positivo, comenzará en `1` y aumentará una vez por cada actualización exitosa.

La tabla de configuración tendrá las restricciones siguientes:

- `prefix` acepta de 1 a 10 caracteres alfanuméricos en mayúscula.
- `code_length` es la longitud alfanumérica del código sin contar el guion y acepta valores de 3 a 20.
- La longitud del prefijo siempre es menor que `code_length` para reservar al menos un dígito de consecutivo.
- El código visible se forma como `<prefix>-<consecutivo con ceros a la izquierda>`.
- Con `prefix = CLI`, `code_length = 6` y `next_sequence = 1`, el primer código es `CLI-001`.
- La creación reserva el consecutivo y crea el Cliente dentro de una única transacción bloqueada, por lo que dos solicitudes no generan el mismo código.
- Un cambio de configuración se aplica solo a Clientes creados posteriormente, conserva los códigos existentes y no permite reducir `next_sequence` por debajo del último consecutivo reservado.
- Si el consecutivo no cabe en los dígitos disponibles, la API rechaza nuevas creaciones con un error controlado y exige ampliar la longitud antes de continuar.

La migración inicial insertará la única fila de `business.client_code_settings` con `id = true`, `prefix = 'CLI'`, `code_length = 6` y `next_sequence = 1`.

La eliminación de Cliente es física.

Solo podrá completarse cuando no existan relaciones; las claves foráneas futuras con `on delete restrict` constituirán la garantía de base de datos.

No se creará una tabla ni endpoint de auditoría general en esta entrega.

Los campos técnicos indican quién y cuándo creó o actualizó un registro existente.

El catálogo RBAC se amplía con estas claves:

| Permiso | Asignación inicial | Uso |
| --- | --- | --- |
| `clients.read` | `administrador`, `lider`, `miembro` | Consultar el listado, el detalle y Clientes inactivos. |
| `clients.manage` | `administrador`, `lider` | Crear, editar, activar, desactivar y eliminar Clientes. |
| `clients.settings.manage` | `administrador` | Consultar y cambiar la configuración de códigos. |

Las rutas HTTP serán:

| Método y ruta | Permiso | Comportamiento |
| --- | --- | --- |
| `GET /api/clients` | `clients.read` | Lista paginada con búsqueda por código o nombre y filtro de estado. |
| `POST /api/clients` | `clients.manage` | Crea un Cliente con código reservado y devuelve su versión inicial. |
| `GET /api/clients/:clientId` | `clients.read` | Devuelve el detalle de un Cliente. |
| `PUT /api/clients/:clientId` | `clients.manage` | Actualiza el nombre o estado cuando la versión enviada coincide. |
| `DELETE /api/clients/:clientId` | `clients.manage` | Elimina definitivamente un Cliente sin relaciones. |
| `GET /api/clients/settings/code` | `clients.settings.manage` | Devuelve la configuración actual. |
| `PUT /api/clients/settings/code` | `clients.settings.manage` | Actualiza la configuración cuando la versión enviada coincide. |

Una solicitud sin sesión recibe `401`.

Una sesión sin el permiso requerido recibe `403`.

Una actualización que use una versión obsoleta recibe `409 Conflict` con un error que invita a recargar los datos.

## Plan de implementación

1. Añadir el script `business:migrate` en `apps/api/package.json` y crear `apps/api/src/business/migrate.ts` con el mismo registro transaccional y bloqueo asesor que usa la migración de autorización; comprobar que detecta solo archivos `NNNN-business-*.sql`, crea `business.schema_migration` y no modifica `auth` ni `authorization`.
2. Crear `apps/api/migrations/0003-business-clients.sql` con la extensión necesaria para UUID, esquema `business`, tablas, restricciones, índices y la configuración inicial `CLI-001`; comprobar que la migración se aplica una vez y que su tabla de control registra el archivo.
3. Crear `apps/api/migrations/0003-authorization-clients-permissions.sql` para insertar los tres permisos, concederlos a los roles de sistema acordados y actualizar la descripción visible de los roles si corresponde; comprobar que es idempotente y no altera los permisos existentes.
4. Ampliar `apps/api/src/authorization/permissions.ts`, tipos y pruebas para reconocer los permisos de Cliente; comprobar que el contexto de autorización los resuelve en la siguiente solicitud.
5. Crear `apps/api/src/clients/` con contratos, repositorio y servicio para leer la configuración, reservar consecutivos de forma atómica, crear Clientes y listar por código, nombre y estado; comprobar que `CLI-001` se genera una única vez ante solicitudes simultáneas.
6. Implementar la modificación con `version`, la activación y desactivación dentro del mismo contrato, y la eliminación física protegida por relaciones; comprobar respuestas `404`, `409` y el rechazo de un Cliente relacionado.
7. Crear `ClientsController` y `ClientsModule`, aplicar los decoradores y guards de SPEC 05, y registrarlos en `apps/api/src/app.module.ts`; comprobar los contratos `401`, `403`, paginación, búsqueda, edición y eliminación.
8. Extender `apps/web/next.config.ts` para reenviar exclusivamente `/api/clients/:path*` al origen interno de `apps/api`; comprobar que las cookies de sesión llegan al backend sin exponer secretos.
9. Crear en `apps/web/src/lib/` los contratos y clientes tipados de Cliente y de configuración de código, incluidos los errores de autorización, conflicto y validación; comprobar sus solicitudes y respuestas con pruebas focalizadas.
10. Ampliar la navegación condicional de `apps/web/src/lib/administration-navigation.ts`, `apps/web/src/components/layout/app-sidebar.tsx` y los tipos asociados para mostrar `Clientes` a quien tenga `clients.read` y la configuración solo a quien tenga `clients.settings.manage`; comprobar escritorio, navegación colapsada y panel móvil.
11. Crear `apps/web/src/app/(app)/clientes/page.tsx` y sus componentes para listado paginado, búsqueda, filtro de estado, detalle, creación, edición, activación, desactivación y confirmación de eliminación; comprobar carga, vacío, error, conflicto, `403` y uso por teclado.
12. Crear `apps/web/src/app/(app)/administracion/configuracion/clientes/page.tsx` y su formulario para prefijo, longitud y consecutivo; comprobar que solo `Administrador` inicial lo ve y que cambiar la configuración no altera Clientes existentes.
13. Añadir pruebas focalizadas de migraciones, restricciones SQL, generación y agotamiento de códigos, concurrencia, permisos, contratos HTTP, navegación y flujos de interfaz; comprobar que los comandos de validación del monorepo siguen siendo ejecutables.

## Criterios de aceptación

- [ ] `corepack pnpm --filter @portal-360/api business:migrate` crea el esquema `business`, su tabla de migraciones y las tablas de Cliente sin cambiar tablas de `auth` ni de `authorization`.
- [ ] `business.client.id` es un UUID generado por PostgreSQL y las relaciones futuras pueden referenciarlo mediante una clave foránea `on delete restrict`.
- [ ] La configuración inicial genera `CLI-001` para el primer Cliente y nunca entrega el mismo código a dos Clientes.
- [ ] El código es único, generado por el sistema e inmutable después de crear el Cliente.
- [ ] Un Administrador con `clients.settings.manage` puede modificar prefijo, longitud y siguiente consecutivo dentro de las restricciones, sin modificar códigos emitidos.
- [ ] La longitud del código incluye solo sus caracteres alfanuméricos y no el guion; `CLI` con longitud `6` genera consecutivos de tres dígitos.
- [ ] El sistema rechaza crear un Cliente cuando el consecutivo no cabe en la longitud configurada y no deja un código duplicado ni un consecutivo incoherente.
- [ ] El nombre obligatorio admite entre 1 y 200 caracteres tras recortar espacios externos y permite valores repetidos.
- [ ] `Administrador` y `Líder` pueden crear, editar, activar, desactivar y eliminar Clientes; `Miembro` puede solo consultarlos; `Estándar` no puede acceder al módulo.
- [ ] La configuración de códigos es visible y modificable inicialmente solo por `Administrador` mediante `clients.settings.manage`.
- [ ] El listado pagina 25 resultados, busca por código o nombre y filtra Activo, Inactivo o Todos.
- [ ] Una edición con versión desactualizada responde `409 Conflict`, no sobrescribe datos ajenos y permite a la interfaz comunicar que debe recargarse.
- [ ] Un Cliente sin relaciones se elimina de forma definitiva y un Cliente con relaciones se conserva porque la base de datos rechaza su eliminación.
- [ ] Un Cliente inactivo puede reactivarse y aparece en el listado cuando el filtro lo incluye.
- [ ] La fila de Cliente conserva `created_at`, `created_by_user_id`, `updated_at` y `updated_by_user_id` vinculados a `auth.user`, sin crear una bitácora general de negocio.
- [ ] La interfaz muestra estados de carga, vacío, error, no autorizado, validación y conflicto mediante los componentes accesibles de SPEC 03.
- [ ] El navegador usa solo `/api/clients/*` y Next.js lo reenvía al backend en el mismo origen.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** esquema `business`; separa los datos operativos de identidad y autorización, y ofrece el lugar para las entidades de negocio posteriores.
- **No:** reutilizar `auth` o `authorization` para Cliente; esos esquemas tienen responsabilidades de identidad y RBAC incompatibles con el dominio de trabajo.
- **Sí:** UUID generado por PostgreSQL como clave interna y de relaciones; el código visible puede cambiar de formato sin afectar referencias.
- **Sí:** código inmutable generado desde una configuración de una sola fila; evita correcciones manuales y permite ajustar los nuevos códigos de Cliente.
- **Sí:** prefijo inicial `CLI` y longitud alfanumérica inicial `6`; establece como primer valor `CLI-001` y deja el formato configurable.
- **No:** número de identificación u otro identificador externo; no es necesario para el alcance actual y se definirá si el negocio lo requiere.
- **Sí:** permitir nombres repetidos; el código de Cliente es el único identificador funcional obligatorio en esta fase.
- **Sí:** estado Activo/Inactivo y reactivación; permite retirar Clientes de la operación sin perderlos.
- **Sí:** eliminación física solo cuando no existan relaciones; evita registros huérfanos sin introducir borrado lógico o restauración antes de necesitarlos.
- **Sí:** `version` y `409 Conflict`; evita que una edición silenciosamente reemplace el cambio de otra persona.
- **Sí:** `clients.read`, `clients.manage` y `clients.settings.manage`; preserva el modelo de permisos fijos y roles configurables de SPEC 05.
- **No:** restringir la pantalla de configuración por el nombre del rol; el permiso `clients.settings.manage` expresa la capacidad y mantiene la coherencia RBAC.
- **No:** tratar al Cliente interno como tipo especial; se crea y administra como cualquier otro Cliente.
- **No:** auditoría general de negocio; los campos técnicos satisfacen la trazabilidad mínima y la bitácora requiere una spec propia.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Dos creaciones concurrentes intentan usar el mismo consecutivo. | Reservar consecutivo y crear Cliente dentro de una sola transacción con bloqueo y conservar una restricción única sobre `code`. |
| La configuración deja el consecutivo sin espacio dentro de la longitud permitida. | Validar prefijo, longitud y siguiente consecutivo al guardar; rechazar nuevas creaciones al agotar los dígitos y comunicar la ampliación necesaria. |
| Un despliegue omite la migración de negocio. | Exponer `business:migrate`, registrar las versiones aplicadas y documentar su ejecución después de las migraciones de autenticación y autorización. |
| Un Usuario elimina un Cliente que posteriormente tenga trabajo asociado. | Declarar en las futuras relaciones `on delete restrict`, mapear el rechazo a un error controlado y ofrecer desactivación como alternativa. |
| Dos personas editan el mismo Cliente o configuración. | Exigir la versión actual y devolver `409 Conflict` sin sobrescribir el registro. |
| El permiso de configuración se concede a un rol adicional. | Mostrar la ruta según `clients.settings.manage`; la asignación inicial queda solo en Administrador y cambios posteriores son trazables por RBAC. |

## Qué **no** está en esta spec

- Contactos, identificación tributaria, dirección, CRM, clasificación o tratamiento especial para el Cliente interno.
- Proyectos, Requerimientos, Tickets, Actividades y relaciones de negocio de Cliente.
- Edición manual del código, restauración, borrado lógico o auditoría general de negocio.
- Una plataforma genérica de códigos para entidades futuras.
- Permisos por Cliente, equipos, propiedad o reglas de visibilidad por registro.
