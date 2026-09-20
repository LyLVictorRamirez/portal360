# SPEC 07 — Entidad de Proyectos y configuración unificada de códigos

> **Status:** Implementada
> **Depends on:** SPEC 03, SPEC 05, SPEC 06
> **Date:** 2026-09-19
> **Objective:** Incorporar Proyectos asociados de forma inmutable a un Cliente, con códigos configurables desde una única pantalla y administración autorizada.

## Por qué existe esta spec

SPEC 06 incorpora el catálogo de Clientes, pero todavía no permite registrar el trabajo de proyecto
que les pertenece.

El modelo de negocio establece que un Proyecto inicia la jerarquía Cliente → Proyecto → Etapa →
Actividad.

Esta entrega crea solo el primer nivel de esa jerarquía y reorganiza la configuración de códigos
para que Cliente y Proyecto se administren desde un único lugar.

## Scope

**In:**

- Migrar la configuración exclusiva de códigos de Cliente a una única tabla `business.entity_code_settings` con filas fijas para `client` y `project`.
- Conservar la configuración, el consecutivo y los códigos de Cliente ya emitidos durante la migración.
- Inicializar la configuración de Proyecto con prefijo `PRY`, longitud alfanumérica `6` y consecutivo `1`, de modo que el primer Proyecto sea `PRY-001`.
- Mantener secuencias independientes para Cliente y Proyecto, aunque se administren desde la misma pantalla.
- Persistir Proyecto con UUID, código visible generado e inmutable, Cliente obligatorio, nombre, descripción u objetivo opcional, fecha de inicio, fecha final comprometida, estado, versión y campos técnicos de creación y actualización.
- Exigir que el Cliente esté activo al crear un Proyecto y conservar inmutable la asociación con el Cliente después de crearlo.
- Usar los estados manuales simples `planned`, `active`, `paused`, `finalized` y `cancelled`, presentados respectivamente como Planeado, Activo, Pausado, Finalizado y Cancelado.
- Permitir cualquier transición entre los estados sin efectos automáticos sobre fechas ni sobre futuras Etapas.
- Permitir a quien tenga `projects.read` listar, buscar y consultar Proyectos, y a quien tenga `projects.manage` crearlos, editarlos, cambiarles el estado y eliminarlos cuando no tengan relaciones.
- Crear los permisos `projects.read`, `projects.manage` y `projects.settings.manage`; asignar inicialmente lectura a Administrador, Líder y Miembro, gestión a Administrador y Líder, y configuración de códigos solo a Administrador.
- Conservar `clients.settings.manage` para la sección de Cliente de la pantalla unificada y no ampliar los permisos de configuración existentes.
- Exponer la API de Proyecto bajo `/api/projects/*` y mantener los endpoints de configuración de Cliente bajo `/api/clients/settings/code` mientras ambos operan sobre la tabla única.
- Crear `/proyectos` con paginación de 25 resultados, búsqueda por código o nombre, filtros por Cliente y estado, orden inicial por actualización descendente, detalle, creación, edición, cambio de estado y eliminación confirmada.
- Reemplazar la configuración exclusiva de Cliente por `/administracion/configuracion/codigos`, una única pantalla que muestre solo las secciones cuyo permiso de configuración posee la persona actual.
- Aplicar concurrencia optimista con `version` tanto al Proyecto como a cada fila de configuración de códigos.
- Usar los componentes, estados visuales y requisitos de accesibilidad de SPEC 03.
- Añadir pruebas focalizadas de migración, consecutivos, autorización, restricciones, contratos HTTP, navegación y pantallas.

**Out of scope (for future specs):**

- Etapas de Proyecto, Actividades, responsables o líderes únicos, porcentaje de avance, hitos, presupuestos, archivos, comentarios o notificaciones.
- Requerimientos, Tickets y cualquier otro contenedor de trabajo.
- Mover un Proyecto a otro Cliente después de crearlo.
- Permisos por Cliente, Proyecto, equipo, propiedad del registro o visibilidad restringida por persona.
- Transiciones automáticas, reglas de cierre, cálculo de avance o efectos derivados del estado del Proyecto.
- Borrado lógico, restauración, una bitácora general de negocio o auditoría consultable.
- Configuración de consecutivos para entidades distintas de Cliente y Proyecto, o un motor abierto de numeración.

## Modelo de datos y configuración

La identidad continúa en `auth.user` y la autorización en `authorization`.

Los datos de Cliente, Proyecto y sus configuraciones de código pertenecen al esquema `business`.

La migración reemplazará `business.client_code_settings` por `business.entity_code_settings` sin
modificar `business.client` ni sus códigos existentes.

| Tabla                           | Campos principales                                                                                                                         | Reglas                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `business.entity_code_settings` | `entity_type`, `prefix`, `code_length`, `next_sequence`, `version`, `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id` | `entity_type` es la clave primaria y acepta solo `client` o `project`; cada entidad tiene su propia fila y consecutivo. |
| `business.project`              | `id`, `client_id`, `code`, `name`, `description`, `start_date`, `committed_end_date`, `status`, `version`, campos técnicos                 | `id` es UUID; `client_id` es obligatorio e inmutable; `code` es único e inmutable; `version` controla concurrencia.     |
| `business.schema_migration`     | `name`, `applied_at`                                                                                                                       | Registra la migración de negocio, según la infraestructura creada en SPEC 06.                                           |

La tabla `business.entity_code_settings` tendrá exactamente dos filas iniciales:

| `entity_type` | Prefijo                                                 | `code_length` | `next_sequence` | Código inicial esperado                   |
| ------------- | ------------------------------------------------------- | ------------- | --------------- | ----------------------------------------- |
| `client`      | Valor migrado desde la configuración vigente de Cliente | Valor migrado | Valor migrado   | Conserva la siguiente emisión de Cliente. |
| `project`     | `PRY`                                                   | `6`           | `1`             | `PRY-001`                                 |

Las restricciones de una configuración de código son las siguientes:

- `prefix` acepta de 1 a 10 caracteres alfanuméricos en mayúscula.
- `code_length` describe solo la longitud alfanumérica completa, sin contar el guion, y admite valores de 3 a 20.
- La longitud del prefijo debe ser menor que `code_length`.
- El código visible se forma como `<prefix>-<consecutivo con ceros a la izquierda>`.
- Cada creación bloquea únicamente la fila correspondiente a su `entity_type`, reserva el consecutivo y crea el registro dentro de una misma transacción.
- Una configuración solo afecta emisiones futuras y nunca reescribe códigos existentes.
- La actualización exige su `version` actual y no puede reducir `next_sequence` por debajo del siguiente consecutivo disponible.
- Si un consecutivo no cabe en la longitud configurada, la creación se rechaza de forma controlada hasta que se amplíe esa longitud.

`business.project` se definirá con la siguiente forma física:

```text
id                  uuid primary key default gen_random_uuid()
client_id           uuid not null references business.client(id) on delete restrict
code                varchar(21) not null unique
name                varchar(200) not null
description         varchar(2000) null
start_date          date not null
committed_end_date  date not null
status              text not null
version             integer not null
created_at          timestamptz not null
created_by_user_id  text not null references auth.user(id) on delete restrict
updated_at          timestamptz not null
updated_by_user_id  text not null references auth.user(id) on delete restrict
```

Las reglas de `business.project` son las siguientes:

- `committed_end_date` debe ser igual o posterior a `start_date`.
- `status` solo acepta `planned`, `active`, `paused`, `finalized` o `cancelled`.
- `name` se recorta antes de validarse, admite entre 1 y 200 caracteres y puede repetirse.
- `description` es opcional y admite hasta 2.000 caracteres.
- `version` es un entero positivo, comienza en `1` y aumenta una vez por cada actualización exitosa.
- La creación comprueba dentro de su transacción que el Cliente existe y está activo.
- Una actualización con una versión obsoleta recibe `409 Conflict` sin sobrescribir el cambio existente.
- Los Proyectos de un Cliente que luego se desactiva siguen siendo consultables, pero no se pueden crear nuevos Proyectos para ese Cliente mientras permanezca inactivo.
- La eliminación es física y solo se completa si no existen relaciones; las futuras tablas de Etapa y demás dependencias declararán `project_id uuid not null references business.project(id) on delete restrict`.

El catálogo RBAC se amplía así:

| Permiso                    | Asignación inicial                  | Uso                                                                |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------ |
| `projects.read`            | `administrador`, `lider`, `miembro` | Listar, buscar y consultar Proyectos.                              |
| `projects.manage`          | `administrador`, `lider`            | Crear, editar, cambiar estado y eliminar Proyectos sin relaciones. |
| `projects.settings.manage` | `administrador`                     | Consultar y modificar la configuración de códigos de Proyecto.     |

Los endpoints de configuración conservan una autorización independiente por entidad:

| Método y ruta                     | Permiso                    | Comportamiento                                                      |
| --------------------------------- | -------------------------- | ------------------------------------------------------------------- |
| `GET /api/clients/settings/code`  | `clients.settings.manage`  | Devuelve solo la fila `client` de `business.entity_code_settings`.  |
| `PUT /api/clients/settings/code`  | `clients.settings.manage`  | Actualiza solo la fila `client` con concurrencia optimista.         |
| `GET /api/projects/settings/code` | `projects.settings.manage` | Devuelve solo la fila `project` de `business.entity_code_settings`. |
| `PUT /api/projects/settings/code` | `projects.settings.manage` | Actualiza solo la fila `project` con concurrencia optimista.        |

Las rutas HTTP de Proyecto serán:

| Método y ruta                     | Permiso           | Comportamiento                                                                                                  |
| --------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `GET /api/projects`               | `projects.read`   | Lista paginada, busca por código o nombre, filtra por Cliente y estado, y ordena por actualización descendente. |
| `POST /api/projects`              | `projects.manage` | Crea un Proyecto para un Cliente activo, reserva su código y devuelve la versión inicial.                       |
| `GET /api/projects/:projectId`    | `projects.read`   | Devuelve el detalle del Proyecto y la referencia visible de su Cliente.                                         |
| `PUT /api/projects/:projectId`    | `projects.manage` | Actualiza nombre, descripción, fechas o estado si la versión enviada coincide.                                  |
| `DELETE /api/projects/:projectId` | `projects.manage` | Elimina definitivamente un Proyecto sin relaciones.                                                             |

Una solicitud sin sesión recibe `401` y una sesión sin el permiso requerido recibe `403`.

## Plan de implementación

1. Crear `apps/api/migrations/0004-business-projects-and-code-settings.sql` para transformar `business.client_code_settings` en `business.entity_code_settings`, migrar su única configuración sin perder su consecutivo, sembrar `project` con `PRY-001` y crear `business.project` con sus restricciones e índices; comprobar que la migración no altera códigos de Cliente ya emitidos.
2. Crear `apps/api/migrations/0004-authorization-projects-permissions.sql` para incorporar los tres permisos de Proyecto y asignarlos a los roles de sistema acordados; comprobar que es idempotente y no modifica permisos existentes fuera del alcance.
3. Actualizar `apps/api/src/clients/clients.contracts.ts`, `clients.repository.ts`, `clients.service.ts`, `clients.controller.ts` y sus pruebas para que los endpoints existentes de Cliente operen sobre la fila `entity_type = 'client'`; comprobar que su contrato HTTP y sus permisos no cambian.
4. Crear `apps/api/src/projects/projects.contracts.ts`, `projects.repository.ts`, `projects.service.ts`, `projects.controller.ts`, `projects.module.ts` y pruebas asociadas para reservar `entity_type = 'project'`, validar datos, verificar el Cliente activo, aplicar versión y realizar operaciones de Proyecto; comprobar concurrencia de consecutivos, fechas, estado, Cliente inactivo y conflicto `409`.
5. Registrar `ProjectsModule` en `apps/api/src/app.module.ts` y proteger cada ruta con los guards y decoradores de SPEC 05; comprobar los contratos `401`, `403`, `404`, conflicto de versión y eliminación bloqueada por relaciones.
6. Extender `apps/web/next.config.ts` para reenviar exclusivamente `/api/projects/:path*` al origen de `apps/api`; comprobar que las solicitudes preservan la sesión del mismo origen.
7. Crear `apps/web/src/lib/projects-client.ts` y sus pruebas para los contratos de listado, detalle, mutaciones, filtros y configuración de código de Proyecto; actualizar `apps/web/src/lib/clients-client.ts` y sus pruebas solo en lo necesario para conservar los contratos de configuración de Cliente.
8. Actualizar `apps/web/src/lib/administration-navigation.ts`, sus pruebas y `apps/web/src/components/layout/app-sidebar.tsx` para mostrar `Proyectos` a quien tenga `projects.read` y la única entrada de configuración de códigos a quien tenga `clients.settings.manage` o `projects.settings.manage`; comprobar navegación de escritorio, colapsada y móvil.
9. Crear `apps/web/src/app/(app)/proyectos/page.tsx`, `project-management.tsx`, `project-editor-dialog.tsx` y `project-delete-dialog.tsx` para el listado, búsqueda, filtros, detalle, selector de Clientes activos, creación, edición, cambio de estado y confirmación de eliminación; comprobar carga, vacío, validación, error, conflicto y acceso no autorizado.
10. Reemplazar `apps/web/src/app/(app)/administracion/configuracion/clientes/` por `apps/web/src/app/(app)/administracion/configuracion/codigos/`, con una página y componentes que presenten las secciones Cliente y Proyecto; comprobar que una persona con un único permiso ve y consulta solo su sección autorizada, y que cada guardado usa el endpoint de su entidad.
11. Ejecutar y ampliar las pruebas focalizadas de migraciones, integridad SQL, consecutivos, permisos, contratos HTTP, navegación y flujos de interfaz; comprobar que los comandos de validación del monorepo siguen siendo ejecutables.

## Criterios de aceptación

- [x] Ejecutar `corepack pnpm --filter @portal-360/api business:migrate` transforma la configuración existente de Cliente en la fila `client` de `business.entity_code_settings`, crea la fila `project` y conserva los códigos de Cliente existentes.
- [x] `business.entity_code_settings` contiene exactamente las filas `client` y `project`, cada una con prefijo, longitud, consecutivo, versión y trazabilidad técnica independientes.
- [x] La configuración migrada de Cliente conserva su siguiente consecutivo y una configuración inicial de Proyecto `PRY`, longitud `6` y consecutivo `1` genera `PRY-001`.
- [x] Dos creaciones simultáneas de Proyectos no reciben el mismo código y una creación de Cliente no bloquea innecesariamente la secuencia de Proyecto.
- [x] Cambiar una configuración de código no modifica ningún código ya emitido y una versión obsoleta responde `409 Conflict`.
- [x] El esquema `business` contiene `project` con UUID, Cliente obligatorio, código único e inmutable, nombre, descripción opcional, fechas, estado, versión y referencias técnicas a `auth.user`.
- [x] No se puede crear ni actualizar un Proyecto cuya fecha final comprometida sea anterior a su fecha de inicio.
- [x] Un Proyecto solo acepta los estados técnicos `planned`, `active`, `paused`, `finalized` y `cancelled`, y la interfaz muestra sus etiquetas en español.
- [x] Un Proyecto solo puede crearse para un Cliente activo y nunca puede trasladarse a otro Cliente mediante la API ni la interfaz.
- [x] Los Proyectos de un Cliente desactivado siguen siendo consultables, pero crear uno nuevo para ese Cliente recibe un error de validación controlado.
- [x] `Administrador` y `Líder` pueden gestionar Proyectos; `Miembro` puede consultarlos; `Estándar` no puede acceder al módulo.
- [x] Solo quien tiene `projects.settings.manage` puede leer o modificar la configuración de Proyecto, y solo quien tiene `clients.settings.manage` puede leer o modificar la de Cliente.
- [x] `/administracion/configuracion/codigos` muestra exclusivamente las secciones autorizadas a la persona actual y no recibe por API los valores de una sección para la que carece de permiso.
- [x] `/proyectos` pagina 25 resultados, busca por código o nombre, filtra por Cliente y estado, y se ordena inicialmente por actualización más reciente.
- [x] El selector de creación solo permite Clientes activos y la edición presenta el Cliente existente como información no modificable.
- [x] Una edición con `version` obsoleta no sobrescribe datos y la interfaz comunica la necesidad de recargar.
- [x] Un Proyecto sin relaciones puede eliminarse de forma definitiva y una relación futura con `on delete restrict` impide eliminarlo.
- [x] El navegador usa únicamente `/api/projects/*` para Proyecto y los endpoints existentes `/api/clients/settings/code` para la configuración de Cliente; Next.js reenvía ambos al backend en el mismo origen.
- [x] La interfaz muestra estados de carga, vacío, error, validación, conflicto y no autorizado mediante los componentes accesibles de SPEC 03.
- [x] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** un Proyecto pertenece obligatoriamente a un Cliente y no puede cambiarse después de crearlo; preserva la relación contractual y evita trasladar trabajo entre Clientes sin un proceso explícito.
- **No:** crear Proyectos para Clientes inactivos; la desactivación impide nuevo trabajo sin ocultar el historial existente.
- **Sí:** código visible inmutable y UUID interno; el UUID sostiene relaciones futuras y el código identifica el Proyecto en operación.
- **Sí:** una sola tabla `business.entity_code_settings` con tipos fijos `client` y `project`; reúne configuraciones relacionadas sin abrir un motor genérico para futuras entidades.
- **No:** reutilizar el consecutivo de Cliente para Proyecto; cada entidad conserva su propio espacio de códigos y puede evolucionar sin colisiones.
- **Sí:** una sola pantalla `/administracion/configuracion/codigos`; reduce la fragmentación de administración y mantiene permisos separados por entidad.
- **No:** devolver la sección de configuración que una persona no puede administrar; la pantalla y la API aplican mínimo privilegio incluso ante permisos parciales.
- **Sí:** `PRY-001` como emisión inicial de Proyecto; es consistente con `CLI-001`, distingue la entidad y conserva el formato configurable.
- **Sí:** nombre repetible y descripción opcional; el código es el identificador funcional único en esta fase.
- **Sí:** fechas de calendario obligatorias y validación de orden; reflejan el inicio explícito y el compromiso final con el Cliente sin introducir programación horaria.
- **Sí:** estados manuales con transiciones libres; el modelo de datos los define como simples y las reglas operativas de cierre pertenecen a una entrega posterior.
- **Sí:** el formulario de creación inicia en `planned`, pero permite elegir cualquier estado válido antes de guardar; facilita el registro inicial sin restringir las transiciones manuales acordadas.
- **Sí:** borrado físico sin relaciones y futuras claves foráneas `on delete restrict`; evita registros huérfanos sin implementar todavía borrado lógico o restauración.
- **Sí:** permisos fijos `projects.read`, `projects.manage` y `projects.settings.manage`; conserva el modelo RBAC versionado de SPEC 05.
- **No:** responsable único, avance manual, Etapas o Actividades; son conceptos confirmados pero requieren una spec independiente para sus reglas y relaciones.

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| La migración puede perder la configuración o el consecutivo vigente de Cliente.         | Ejecutar la transformación dentro de una transacción, copiar la fila actual a `entity_type = 'client'` y cubrirla con pruebas de migración y de emisión posterior. |
| Dos tipos de código comparten una tabla y podrían reservar el mismo consecutivo.        | Bloquear la fila específica por `entity_type`, conservar la restricción primaria y probar creaciones concurrentes de ambas entidades.                              |
| Una persona con permiso de una sección obtendría por error la configuración de la otra. | Proteger cada endpoint por su permiso propio y devolver desde la pantalla solo las secciones previamente autorizadas.                                              |
| Desactivar un Cliente puede dejar Proyectos visibles que parezcan editables.            | Conservar la consulta y edición de los Proyectos existentes, pero validar el estado activo únicamente al crear un Proyecto nuevo y comunicarlo en la interfaz.     |
| Las futuras Etapas impedirán eliminaciones que hoy sí son válidas.                      | Declarar desde esta spec la clave foránea futura con `on delete restrict` y mapear su rechazo a un error controlado cuando la relación exista.                     |

## Qué **no** está en esta spec

- Etapas, Actividades, responsables, avances, presupuestos, archivos, comentarios o automatizaciones de Proyecto.
- Requerimientos, Tickets, relaciones de trabajo adicionales y permisos por registro o equipo.
- Trasladar un Proyecto a otro Cliente, borrado lógico, restauración o auditoría general de negocio.
- Un motor de códigos extensible a entidades distintas de Cliente y Proyecto.
