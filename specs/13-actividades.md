# SPEC 13 — Actividades y categorías operativas

> **Status:** Implementada
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 10, SPEC 11, SPEC 12
> **Date:** 2026-09-22
> **Objective:** Gestionar Actividades de Proyecto, Requerimiento o Ticket con responsables, categorías, jerarquía, secuencia y trazabilidad operativa desde un módulo privado autorizado.

## Por qué existe esta spec

Clientes, Proyectos, Requerimientos, Tickets y Etapas ya están disponibles, pero aún no registran el
trabajo concreto que organiza la operación diaria.

Esta spec crea la primera unidad de trabajo común y conserva su línea de tiempo desde el inicio, sin
adelantar las capacidades de planificación y ejecución que pertenecen a Agenda, Tiempo y
Dependencias.

## Alcance

**Incluye:**

- Crear las entidades `business.activity`, `business.activity_category` y `business.audit_event`.
- Asociar cada Actividad a exactamente un Proyecto, Requerimiento o Ticket.
- Exigir una Etapa del mismo Proyecto para cada Actividad de Proyecto.
- Crear, consultar, editar, ordenar y eliminar Actividades desde `/actividades`.
- Usar un Sheet Form lateral para crear, editar y consultar detalle de una Actividad.
- Permitir una jerarquía de dos niveles: Actividad raíz e hija.
- Gestionar responsable, estado, prioridad, categoría, estimación, fechas y condición de entregable.
- Registrar los datos actuales de bloqueo y espera de tercero mientras el estado correspondiente esté
  activo.
- Administrar categorías desde `/administracion/categorias-actividad`.
- Registrar automáticamente la creación, modificación, cambio de estado, reordenamiento y
  eliminación de Actividades en una línea de tiempo consultable.
- Añadir `activities.read`, `activities.manage` y `activity-categories.manage` al catálogo RBAC.
- Exponer los contratos bajo `/api/activities/*` y `/api/activity-categories/*` mediante el origen
  web único.
- Aplicar los estados, accesibilidad y sistema visual de SPEC 03 y SPEC 09.
- Añadir pruebas focalizadas de migración, autorización, reglas de negocio, contratos, cliente web
  y pantallas.

**Fuera de alcance (para futuras specs):**

- Dependencias entre Actividades, ciclos, excepciones de finalización y sus motivos.
- Agenda, capacidad, condición semanal, ausencias, horarios o bloques sin Actividad.
- Registros de Tiempo.
- Comentarios, menciones, notificaciones, adjuntos o archivos.
- Borrado lógico, restauración, permisos por registro, por Cliente, por Proyecto o por equipo.
- Auditoría de entidades distintas de Actividad y una pantalla transversal de auditoría.
- Un perfil laboral distinto de `auth.user`, Microsoft Entra ID y la deshabilitación administrativa
  de cuentas.

## Modelo de datos y contratos

La identidad continúa en `auth.user`, la autorización en `authorization` y los datos operativos en
`business`.

La migración creará `business.activity_category` con la siguiente forma física:

```text
id                  uuid primary key default gen_random_uuid()
name                varchar(100) not null
is_active           boolean not null default true
version             integer not null default 1
created_at          timestamptz not null
created_by_user_id  text null references auth.user(id) on delete restrict
updated_at          timestamptz not null
updated_by_user_id  text null references auth.user(id) on delete restrict
```

`name` se recorta, admite entre 1 y 100 caracteres y es único sin distinguir mayúsculas. Las siete
filas iniciales activas serán `Desarrollo`, `Pruebas`, `Reuniones`, `Consultoría`,
`Documentación`, `Soporte` y `Estabilización`. Una categoría no se elimina físicamente. Una
categoría inactiva se conserva en las Actividades históricas, pero no puede seleccionarse al crear o
editar una Actividad.

La migración creará `business.activity` con la siguiente forma física:

```text
id                              uuid primary key default gen_random_uuid()
project_id                      uuid null references business.project(id) on delete restrict
requirement_id                  uuid null references business.requirement(id) on delete restrict
ticket_id                       uuid null references business.ticket(id) on delete restrict
project_stage_id                uuid null references business.project_stage(id) on delete restrict
parent_activity_id              uuid null references business.activity(id) on delete restrict
assigned_user_id                text not null references auth.user(id) on delete restrict
activity_category_id            uuid not null references business.activity_category(id) on delete restrict
name                            varchar(200) not null
description                     jsonb null
status                          text not null default 'pending'
priority                        text not null default 'medium'
estimated_hours                 numeric(10,2) not null
target_date                     date null
is_customer_deliverable         boolean not null default false
customer_commitment_date        date null
position                        integer not null
blocked_reason                  varchar(2000) null
blocked_started_at              timestamptz null
waiting_reason                  varchar(2000) null
waiting_for                     text null
waiting_started_at              timestamptz null
version                         integer not null default 1
created_at                      timestamptz not null
created_by_user_id              text not null references auth.user(id) on delete restrict
updated_at                      timestamptz not null
updated_by_user_id              text not null references auth.user(id) on delete restrict
```

La base de datos exigirá que exactamente uno de `project_id`, `requirement_id` y `ticket_id` tenga
valor. `project_stage_id` será obligatorio únicamente cuando exista `project_id` y deberá
pertenecer a ese mismo Proyecto. Será nulo para Requerimientos y Tickets.

Las reglas de `business.activity` serán las siguientes:

- `name` se recorta y admite entre 1 y 200 caracteres.
- `description` es opcional, se guarda como documento JSON enriquecido y admite hasta 2.000
  caracteres de texto visible. Solo permite párrafos, negrita, cursiva, subrayado, listas y enlaces
  HTTP(S).
- `status` acepta `pending`, `in_progress`, `in_review`, `customer_testing`, `blocked`,
  `waiting_third_party` o `finalized`.
- `priority` acepta `critical`, `high`, `medium` o `low` y la creación sin valor explícito usa
  `medium`.
- `estimated_hours` es obligatoria, positiva y conserva hasta dos decimales.
- `customer_commitment_date` es obligatoria cuando `is_customer_deliverable` es verdadera y nula
  cuando es falsa.
- `blocked_reason` y `blocked_started_at` son obligatorios solo para el estado `blocked`.
- `waiting_reason`, `waiting_for` y `waiting_started_at` son obligatorios solo para el estado
  `waiting_third_party`; `waiting_for` acepta `client`, `provider` u `other`.
- Al abandonar `blocked` o `waiting_third_party`, el sistema limpia sus datos actuales. La
  transición completa permanece en auditoría.
- `parent_activity_id` es opcional. La Actividad padre debe ser raíz, pertenecer al mismo
  contenedor y, para Proyectos, a la misma Etapa. Una hija no puede tener hijas.
- El contenedor es inmutable después de crear. En Actividades de Proyecto se puede cambiar de Etapa
  dentro del mismo Proyecto, siempre que la Actividad no tenga hijas. Una hija no puede escoger una
  Etapa distinta de la de su padre.
- `position` es un entero positivo. Las raíces se ordenan dentro de su contenedor y las hijas dentro
  de su padre. Crear agrega al final y mover intercambia una posición con la hermana inmediata.
- `version` es positivo, inicia en `1` y aumenta una vez por cada modificación o movimiento
  exitoso.
- El responsable debe ser una cuenta verificada con acceso vigente a la aplicación. Cualquiera de
  los roles Administrador, Líder o Miembro puede ser responsable.
- No se puede crear ni editar una Actividad vinculada a un Proyecto `finalized` o `cancelled`.
- Se puede crear una Actividad de Requerimiento en cualquier estado no terminal: `new`,
  `in_analysis`, `quoted`, `approved`, `in_execution` o `paused`. No se puede crear para un
  Requerimiento `finalized` o `cancelled`.
- Un Ticket no recibe restricciones de estado, porque su plataforma externa continúa siendo la
  fuente de verdad.
- La eliminación es física y solo procede si la Actividad no tiene hijas. Las relaciones futuras de
  Dependencia, Agenda, Tiempo, Comentario y Archivo deberán usar `on delete restrict`.

La migración creará una base de auditoría reutilizable, inicialmente alimentada solo por
Actividades:

```text
id                uuid primary key default gen_random_uuid()
entity_type       text not null
entity_id         uuid not null
action            text not null
actor_user_id     text not null references auth.user(id) on delete restrict
occurred_at       timestamptz not null
changes           jsonb not null
reason            varchar(2000) null
context           jsonb null
```

`entity_type` tendrá inicialmente el valor `activity`. `action` aceptará `create`, `modify` y
`delete`. `changes` guardará por campo el valor anterior y posterior. La eliminación no tendrá una
clave foránea a `business.activity`, para conservar su evento y la fotografía final aun después de
la eliminación física. Cada mutación de Actividad y cada una de las dos Actividades afectadas por
un reordenamiento crea su evento dentro de la misma transacción.

Los tipos públicos serán:

```text
ActivityStatus = pending | in_progress | in_review | customer_testing | blocked |
  waiting_third_party | finalized
ActivityPriority = critical | high | medium | low
ActivityWaitingFor = client | provider | other
ActivityContainerType = project | requirement | ticket
```

| Estado                | Etiqueta          |
| --------------------- | ----------------- |
| `pending`             | Pendiente         |
| `in_progress`         | En progreso       |
| `in_review`           | En revisión       |
| `customer_testing`    | Pruebas cliente   |
| `blocked`             | Bloqueada         |
| `waiting_third_party` | Esperando tercero |
| `finalized`           | Finalizada        |

| Prioridad  | Etiqueta |
| ---------- | -------- |
| `critical` | Crítica  |
| `high`     | Alta     |
| `medium`   | Media    |
| `low`      | Baja     |

El catálogo RBAC se amplía así:

| Permiso                      | Asignación inicial                  | Uso                                                          |
| ---------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `activities.read`            | `administrador`, `lider`, `miembro` | Consultar Actividades, categorías activas y línea de tiempo. |
| `activities.manage`          | `administrador`, `lider`, `miembro` | Crear, editar, ordenar y eliminar Actividades autorizadas.   |
| `activity-categories.manage` | `administrador`                     | Crear, renombrar, activar y desactivar categorías.           |

Las rutas HTTP serán:

| Método y ruta                                       | Permiso                      | Comportamiento                                                                                                                                                                   |
| --------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/activities`                               | `activities.read`            | Lista paginada de 25, busca por nombre, filtra por contenedor, Cliente, entidad contenedora, responsable, estado, prioridad y categoría, y ordena por actualización descendente. |
| `POST /api/activities`                              | `activities.manage`          | Crea una Actividad y registra su evento `create`.                                                                                                                                |
| `GET /api/activities/:activityId`                   | `activities.read`            | Devuelve detalle, contenedor visible, padre si existe y categoría.                                                                                                               |
| `PUT /api/activities/:activityId`                   | `activities.manage`          | Actualiza con versión vigente y registra el diff.                                                                                                                                |
| `POST /api/activities/:activityId/move`             | `activities.manage`          | Mueve una posición con `{ direction, version }` y audita las filas afectadas.                                                                                                    |
| `DELETE /api/activities/:activityId?version=<n>`    | `activities.manage`          | Elimina una Actividad sin hijas y conserva su evento `delete`.                                                                                                                   |
| `GET /api/activities/:activityId/audit-events`      | `activities.read`            | Devuelve la línea de tiempo completa en orden descendente.                                                                                                                       |
| `GET /api/activity-categories`                      | `activities.read`            | Devuelve las categorías activas para seleccionar en una Actividad.                                                                                                               |
| `GET /api/activity-categories?includeInactive=true` | `activity-categories.manage` | Devuelve todas las categorías para administración.                                                                                                                               |
| `POST /api/activity-categories`                     | `activity-categories.manage` | Crea una categoría activa.                                                                                                                                                       |
| `PUT /api/activity-categories/:categoryId`          | `activity-categories.manage` | Renombra o cambia el estado con versión vigente.                                                                                                                                 |

Una solicitud sin sesión recibe `401`. Una sesión sin el permiso requerido recibe `403`. Una versión
obsoleta recibe `409 Conflict` sin sobrescribir. Las reglas de contenedor, jerarquía, estado,
categoría, responsable, fecha, orden y eliminación reciben `422` con un mensaje controlado.

## Plan de implementación

1. Crear `apps/api/migrations/0009-business-activities.sql` con `activity_category`, `activity` y
   `audit_event`, sus restricciones, datos iniciales, índices y claves restrictivas; comprobar que
   no altera datos de Clientes, Proyectos, Requerimientos, Tickets ni Etapas existentes.
2. Crear `apps/api/migrations/0009-authorization-activities-permissions.sql` y ampliar
   `apps/api/src/authorization/permissions.ts`, tipos y pruebas para los tres permisos nuevos;
   comprobar asignaciones idempotentes a los roles de sistema.
3. Crear `apps/api/src/activity-categories/` con contratos, repositorio, servicio, controlador,
   módulo y pruebas para listado activo, listado administrativo, alta, renombre, activación,
   desactivación, unicidad y concurrencia.
4. Crear `apps/api/src/activities/` con contratos, repositorio, servicio, controlador, módulo y
   pruebas para contenedor exclusivo, Etapa, reglas de estado, responsable, categoría, jerarquía,
   versión, eliminación, orden y filtros.
5. Incorporar la escritura transaccional de `business.audit_event` y el endpoint de línea de tiempo
   dentro del módulo de Actividades; comprobar diffs, actor, orden cronológico y conservación del
   evento de eliminación.
6. Registrar los módulos nuevos en `apps/api/src/app.module.ts`, aplicar guards y decoradores de
   SPEC 05, y comprobar respuestas `401`, `403`, `404`, `409` y `422`.
7. Extender `apps/web/next.config.ts` para reenviar solo `/api/activities/:path*` y
   `/api/activity-categories/:path*` al API; comprobar la preservación de sesión del mismo origen.
8. Crear `apps/web/src/lib/activities-client.ts`, `activity-categories-client.ts` y sus pruebas
   para listado, detalle, mutaciones, orden, filtros, categorías y auditoría.
9. Actualizar la navegación condicionada por permisos para mostrar `Actividades` a quien tenga
   `activities.read` y la administración de categorías a quien tenga
   `activity-categories.manage`.
10. Crear `apps/web/src/app/(app)/actividades/` con el listado y un Sheet Form lateral, de ancho
    amplio en escritorio y ancho completo en móvil, con cabecera y acciones fijas y cuerpo
    desplazable; comprobar creación, edición, detalle, filtros, orden, eliminación y la línea de
    tiempo.
11. Crear `apps/web/src/app/(app)/administracion/categorias-actividad/` para administrar el
    catálogo, incluyendo categorías inactivas y conflictos de concurrencia; comprobar que una
    categoría inactiva no se puede escoger en el Sheet Form.
12. Añadir pruebas focalizadas de migración, restricciones SQL, permisos, contratos HTTP, cliente,
    navegación, Sheet Form, administración y línea de tiempo; ejecutar los comandos de validación
    definidos por el monorepo.

## Criterios de aceptación

- [ ] La migración crea las tres entidades y las siete categorías iniciales sin modificar datos
      existentes.
- [ ] Cada Actividad tiene exactamente un contenedor y solo una Actividad de Proyecto exige una
      Etapa de ese mismo Proyecto.
- [ ] Un contenedor no cambia después de crear y una Actividad hija comparte contenedor y Etapa con
      su padre.
- [ ] No existen jerarquías de más de dos niveles ni se puede eliminar una Actividad con hijas.
- [ ] Nombre, descripción, estimación, prioridad, fechas de entrega y datos de bloqueo o espera se
      validan según las reglas definidas.
- [ ] Una Actividad sin prioridad explícita queda con `medium`.
- [ ] Al salir de bloqueo o espera se limpian sus datos actuales y la transición permanece en la
      auditoría.
- [ ] Una Actividad no se puede crear ni editar en un Proyecto finalizado o cancelado.
- [ ] Una Actividad de Requerimiento se crea en cualquier estado no terminal, incluido `paused`, y
      se rechaza para un Requerimiento finalizado o cancelado.
- [ ] El responsable es una cuenta verificada con acceso vigente y puede tener cualquiera de los
      tres roles operativos.
- [ ] El orden agrega al final y mover intercambia exactamente con la hermana inmediata, con
      conflictos controlados ante concurrencia.
- [ ] Administrador, Líder y Miembro pueden consultar y gestionar Actividades; únicamente
      Administrador administra categorías.
- [ ] Las categorías son únicas sin distinguir mayúsculas, se pueden activar o desactivar y una
      inactiva no se ofrece para alta o edición.
- [ ] `/actividades` pagina 25 resultados, busca por nombre, aplica todos los filtros acordados y
      inicia por actualización descendente.
- [ ] El Sheet Form presenta ubicación, planificación y seguimiento, mantiene acciones fijas y se
      adapta a escritorio y móvil.
- [ ] La Descripción usa un editor enriquecido limitado y el detalle muestra su contenido de forma segura.
- [ ] La ficha de Actividad muestra una línea de tiempo con todos sus cambios, incluidos creación,
      edición, estado, responsable, fechas, categoría, secuencia y eliminación mientras sea aplicable.
- [ ] Cada mutación de Actividad registra auditoría con actor, fecha/hora, acción y valores
      anteriores y nuevos; un evento de eliminación continúa disponible tras borrar la Actividad.
- [ ] La interfaz comunica de forma accesible los estados de carga, vacío, validación, error,
      conflicto y no autorizado.
- [ ] Las pruebas focalizadas y `corepack pnpm lint`, `corepack pnpm typecheck`,
      `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código
      `0`.

## Decisiones

- **Sí:** tres claves foráneas de contenedor con una restricción de exactamente una; conserva la
  integridad referencial sin introducir una asociación polimórfica sin claves reales.
- **Sí:** Etapa obligatoria solo para Proyecto; respeta la estructura de SPEC 12 sin cargar esa
  noción en Requerimientos ni Tickets.
- **Sí:** contenedor inmutable y Etapa movible dentro de Proyecto; preserva el origen del trabajo y
  permite ajustar su organización operativa.
- **Sí:** jerarquía padre/hija de dos niveles y orden por hermanas; cubre descomposición y secuencia
  sin convertir Actividad en un árbol ilimitado.
- **Sí:** `activities.manage` para Administrador, Líder y Miembro; las tres personas operativas
  pueden mantener el trabajo sin una frontera adicional por rol.
- **Sí:** catálogo de categorías configurable y administrado solo por Administrador; la categoría
  obligatoria requiere gobernanza sin abrir permisos de configuración a toda la operación.
- **Sí:** los campos de actor de las categorías permiten `null` únicamente para las siete filas
  semilla de la migración; una migración puede ejecutarse sin usuarios y las operaciones de la
  aplicación siempre registran su actor.
- **Sí:** Sheet Form lateral, ancho en escritorio y pantalla completa en móvil; conserva el contexto
  del listado y proporciona espacio para los datos operativos.
- **Sí:** auditoría genérica persistente desde esta spec, inicialmente solo para Actividades; permite
  una línea de tiempo inmediata y una base reutilizable sin implementar aún auditoría global.
- **Sí:** limpiar datos activos de bloqueo y espera al salir de esos estados; evita representar el
  estado actual con información obsoleta y conserva la historia mediante auditoría.
- **Sí:** descripción enriquecida limitada, almacenada como JSON estructurado; permite expresar el
  trabajo con formato y enlaces sin aceptar HTML arbitrario, imágenes, tablas o adjuntos.
- **Sí:** los Requerimientos en `paused` admiten Actividades porque no son terminales; únicamente
  `finalized` y `cancelled` bloquean su creación.
- **No:** Dependencias en esta spec; requieren validación de ciclos, reglas de finalización y
  excepciones de rol que merecen una unidad funcional propia.
- **No:** Agenda, capacidad, tiempo, comentarios y notificaciones; consumen Actividades, pero no
  son necesarios para registrar y administrar su núcleo operativo.

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                           |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Una relación contenedor–Etapa o padre–hija inconsistente deja trabajo en una ubicación inválida. | Validar claves, pertenencia y profundidad en base de datos cuando sea posible y dentro de transacciones de servicio. |
| Dos personas reordenan las mismas hermanas simultáneamente.                                      | Exigir versión de origen, bloquear el grupo afectado en la transacción y devolver `409` ante datos obsoletos.        |
| Borrar una Actividad elimina la evidencia de una decisión operativa.                             | Registrar el evento `delete` con su fotografía final sin clave foránea a la fila eliminada.                          |
| Una categoría desactivada deja Actividades históricas difíciles de interpretar.                  | Mostrar su etiqueta histórica en detalle y línea de tiempo, pero excluirla de los selectores de cambio.              |
| El detalle y la línea de tiempo crecen cuando aumentan las Actividades.                          | Consultar la auditoría por endpoint independiente y cargarla solo al abrir el detalle.                               |

## Qué **no** está en esta spec

- Dependencias, prevención de ciclos, excepciones de cierre y bloqueos entre Actividades.
- Agenda, planificación semanal, capacidad, horarios, ausencias o registros de Tiempo.
- Comentarios, menciones, notificaciones, archivos, adjuntos o chat.
- Borrado lógico, restauración o permisos por registro, equipo o contenedor.
- Auditoría de Clientes, Proyectos, Requerimientos, Tickets, Etapas o categorías.
