# SPEC 14 — Dependencias de Actividades

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 13
> **Date:** 2026-09-24
> **Objective:** Gestionar dependencias fin-a-inicio entre Actividades del mismo contenedor para comunicar su secuencia operativa sin impedir excepciones de finalización.

## Por qué existe esta spec

SPEC 13 permite registrar y ordenar Actividades, pero no expresa cuáles deben realizarse antes de
otras dentro del mismo trabajo.

Esta spec incorpora esa secuencia como información visible y trazable, sin convertirla en un flujo
inflexible que impida finalizar una Actividad cuando exista una excepción operativa válida.

## Alcance

**Incluye:**

- Crear relaciones de dependencia fin-a-inicio entre Actividades del mismo contenedor.
- Permitir varias predecesoras y varias sucesoras por Actividad.
- Rechazar dependencias a sí misma, duplicadas o que formen un ciclo directo o indirecto.
- Mostrar predecesoras y sucesoras en el detalle lateral existente de la Actividad.
- Permitir buscar, agregar y quitar predecesoras desde la sección `Dependencias` del detalle y
  del formulario de edición; al crear, permitir seleccionar predecesoras existentes y crear sus
  relaciones después de guardar la nueva Actividad. El buscador usará el mismo patrón de combobox
  remoto del selector de Cliente, en lugar de una lista persistente de resultados.
- Mostrar una advertencia persistente cuando una Actividad tenga predecesoras no `finalized`.
- Mostrar una advertencia más visible al seleccionar `finalized` si existen predecesoras pendientes,
  sin impedir guardar el cambio de estado ni solicitar un motivo de excepción.
- Mantener la advertencia cuando una predecesora se reabra y una sucesora ya esté finalizada.
- Bloquear la eliminación de una Actividad que tenga predecesoras o sucesoras y explicar las
  Actividades relacionadas.
- Registrar el alta y la baja de cada dependencia en la línea de tiempo de ambas Actividades.
- Exigir la versión vigente de la Actividad sucesora al crear o quitar una dependencia y aumentar
  esa versión al completar la mutación.
- Reutilizar `activities.read` para consultar relaciones y `activities.manage` para administrarlas.
- Añadir pruebas focalizadas de migración, integridad, API, cliente web y detalle lateral.

**Fuera de alcance (para futuras specs):**

- Dependencias inicio-a-inicio, fin-a-fin, inicio-a-fin, retardos o calendarios.
- Bloquear automáticamente transiciones de estado o exigir una justificación de excepción.
- Dependencias entre contenedores distintos, incluidos Proyectos, Requerimientos o Tickets
  diferentes.
- Diagramas de red, ruta crítica, Gantt, cálculo de fechas, capacidad o Agenda.
- Notificaciones, comentarios, archivos o asignación automática derivada de una dependencia.

## Modelo de datos y contratos

La migración `apps/api/migrations/0011-business-activity-dependencies.sql` creará
`business.activity_dependency` con la siguiente forma física:

```text
predecessor_activity_id  uuid not null references business.activity(id) on delete restrict
successor_activity_id    uuid not null references business.activity(id) on delete restrict
created_at               timestamptz not null
created_by_user_id       text not null references auth.user(id) on delete restrict
primary key (predecessor_activity_id, successor_activity_id)
```

Cada fila representa exclusivamente una dependencia fin-a-inicio: la Actividad indicada por
`predecessor_activity_id` debería finalizar antes de que inicie o finalice la indicada por
`successor_activity_id`.

La tabla tendrá una restricción que impida que ambos identificadores sean iguales.

Una función y trigger de PostgreSQL validarán al insertar que predecesora y sucesora pertenezcan al
mismo contenedor y que la nueva arista no cierre un ciclo, incluidos los ciclos indirectos.

La eliminación de una Actividad seguirá siendo física, pero se rechazará mientras exista una fila en
`business.activity_dependency` que la mencione como predecesora o sucesora.

El contrato público añadirá la siguiente vista de relación:

```text
ActivityDependency = {
  id: string;
  name: string;
  status: ActivityStatus;
  version: number;
}

ActivityDependencies = {
  predecessors: ActivityDependency[];
  successors: ActivityDependency[];
}
```

`ActivityDependencies` se ordenará por `name` ascendente y después por `id` ascendente.

Una predecesora está pendiente cuando su `status` es distinto de `finalized`.

El detalle de Actividad incluirá `dependencies`, con las dos listas anteriores, para que el cliente
pueda calcular y presentar la advertencia sin inferir relaciones desde el listado global.

Las rutas HTTP serán:

| Método y ruta                                                            | Permiso             | Comportamiento                                                                                        |
| ------------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/activities/:activityId/dependencies`                           | `activities.read`   | Devuelve las predecesoras y sucesoras actuales.                                                       |
| `POST /api/activities/:activityId/dependencies`                          | `activities.manage` | Crea una dependencia con cuerpo `{ predecessorActivityId, version }`, donde `activityId` es sucesora. |
| `DELETE /api/activities/:activityId/dependencies/:predecessorActivityId` | `activities.manage` | Quita la dependencia con `?version=<n>`, donde `activityId` es sucesora.                              |

El selector de predecesoras reutilizará `GET /api/activities` con los filtros de `containerId` y
`containerType` de la Actividad sucesora, y búsqueda por nombre.

El servicio excluirá la Actividad actual y las predecesoras ya vinculadas de las opciones del
selector. La validación del servidor conservará la autoridad sobre duplicados, contenedor, ciclos y
versiones aunque el cliente esté desactualizado.

Crear o quitar una dependencia bloqueará transaccionalmente la Actividad sucesora, comprobará su
`version`, escribirá o retirará la relación, aumentará una vez la versión de la sucesora y añadirá
un evento `modify` a `business.audit_event` para ambas Actividades dentro de la misma transacción.

Los cambios de auditoría usarán `predecessors` en la sucesora y `successors` en la predecesora,
incluyendo el identificador y nombre de la Actividad agregada o retirada.

Las solicitudes sin sesión reciben `401` y quienes no tengan el permiso requerido reciben `403`.

Una versión obsoleta recibe `409 Conflict`.

Las relaciones inválidas por actividad inexistente reciben `404`.

Las relaciones consigo misma, duplicadas, entre contenedores distintos o circulares reciben `422`
con un mensaje controlado.

Eliminar una Actividad relacionada recibe `409 Conflict` e identifica sus predecesoras y sucesoras
por nombre.

## Plan de implementación

1. Crear `apps/api/migrations/0011-business-activity-dependencies.sql` con
   `business.activity_dependency`, claves restrictivas, comprobación de identidad, índices y la
   validación transaccional de mismo contenedor y ausencia de ciclos; comprobar que se aplica sin
   crear relaciones para Actividades existentes.
2. Extender `apps/api/src/activities/activities.contracts.ts` con los tipos de dependencia,
   entradas de alta y baja, detalle de Actividad y errores controlados; comprobar que los contratos
   distinguen predecesora, sucesora y versión de la sucesora.
3. Ampliar `apps/api/src/activities/activities.repository.ts` y
   `apps/api/src/activities/activities.service.ts` para consultar relaciones, crear y retirar
   dependencias dentro de transacciones, detectar ciclo, actualizar la versión de la sucesora,
   registrar auditoría bilateral y describir relaciones que bloquean una eliminación.
4. Actualizar `apps/api/src/activities/activities.controller.ts` con las tres rutas de
   dependencias y su traducción consistente de `401`, `403`, `404`, `409` y `422`; comprobar que
   `activities.read` solo consulta y `activities.manage` muta.
5. Añadir y ampliar las pruebas de migración, repositorio, servicio y controlador de Actividades
   para cubrir contenedor, autorrelación, duplicado, ciclo directo e indirecto, concurrencia,
   auditoría bilateral, advertencia de predecesoras pendientes y eliminación bloqueada en ambas
   direcciones.
6. Extender `apps/web/src/lib/activities-client.ts` y
   `apps/web/src/lib/activities-client.test.ts` para leer las dependencias del detalle y ejecutar
   sus mutaciones propagando la versión, los conflictos y los errores de validación.
7. Actualizar `apps/web/src/app/(app)/actividades/activity-sheet.tsx`, el formulario de creación y
   edición, y sus pruebas para añadir la sección `Dependencias`, con un combobox de predecesoras
   del mismo contenedor como el selector de Cliente, alta, baja, estados de carga, vacío, error y
   conflicto accesibles.
8. Actualizar el formulario de edición y el detalle de la Actividad para mostrar la advertencia de
   predecesoras pendientes persistentemente y al seleccionar `finalized`, dejando disponible la
   acción de guardar; comprobar el caso de una sucesora finalizada cuya predecesora se reabre.
9. Ejecutar las pruebas focalizadas de migración, Actividades y cliente web, y comprobar los
   comandos de validación definidos por el monorepo.

## Criterios de aceptación

- [ ] La migración crea `business.activity_dependency` sin relaciones artificiales para las
      Actividades existentes y conserva claves foráneas restrictivas hacia ambas Actividades.
- [ ] Una dependencia representa solo fin-a-inicio y siempre conecta dos Actividades del mismo
      contenedor.
- [ ] Una Actividad puede tener varias predecesoras y varias sucesoras.
- [ ] No se puede crear una relación consigo misma, duplicada, directa o indirectamente circular.
- [ ] El detalle devuelve predecesoras y sucesoras ordenadas por nombre e identifica su estado
      actual.
- [ ] Una Actividad con al menos una predecesora distinta de `finalized` muestra una advertencia
      persistente con los nombres de las pendientes.
- [ ] Elegir `finalized` muestra la advertencia más visible, pero permite guardar la Actividad sin
      exigir ni registrar un motivo de excepción.
- [ ] Si una predecesora se reabre, su sucesora muestra la advertencia aunque ya esté `finalized` y
      el sistema no modifica automáticamente ese estado.
- [ ] La sección `Dependencias` del detalle y la edición permite buscar, agregar y quitar únicamente
      predecesoras del mismo contenedor; la creación permite seleccionar predecesoras existentes y
      las vincula después de crear la Actividad. El control de búsqueda usa el combobox del patrón
      de Cliente y no muestra una lista persistente de resultados.
- [ ] Crear o quitar una dependencia exige la versión vigente de la sucesora, aumenta su versión
      una vez y devuelve `409 Conflict` ante cambios simultáneos.
- [ ] Crear o quitar una dependencia genera un evento de auditoría en ambas Actividades que
      identifica la relación agregada o retirada.
- [ ] Solo quien tiene `activities.manage` puede crear o quitar dependencias; quien tiene
      `activities.read` puede consultarlas.
- [ ] No se puede eliminar una Actividad que tenga predecesoras o sucesoras y el error identifica
      las Actividades relacionadas.
- [ ] La interfaz comunica de forma accesible los estados de carga, vacío, validación, error y
      conflicto de concurrencia.
- [ ] Las pruebas focalizadas y `corepack pnpm lint`, `corepack pnpm typecheck`,
      `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código
      `0`.

## Decisiones

- **Sí:** solo dependencia fin-a-inicio; es la relación que expresa la secuencia deseada con el
  modelo actual de estados y no necesita fechas reales de inicio o finalización.
- **No:** dependencias inicio-a-inicio, fin-a-fin e inicio-a-fin; requieren planificación temporal
  que Portal 360 todavía no registra.
- **Sí:** permitir finalizar pese a predecesoras pendientes; una dependencia informa la secuencia y
  la operación puede tener excepciones legítimas.
- **No:** solicitar o almacenar un motivo al finalizar en excepción; añade fricción y una nueva
  semántica de auditoría que no se requiere ahora.
- **Sí:** advertencia persistente y reforzada al seleccionar `finalized`; hace visible el riesgo sin
  convertirlo en un bloqueo del flujo.
- **Sí:** limitar las relaciones al mismo contenedor; evita enlazar trabajo sin un contexto
  operativo común.
- **Sí:** prevenir ciclos en base de datos y servicio; una red cíclica no ofrece un orden operativo
  interpretable.
- **Sí:** reutilizar `activities.read` y `activities.manage`; las dependencias son parte del mismo
  límite de administración de una Actividad.
- **Sí:** concurrencia optimista sobre la sucesora; sus predecesoras forman parte de su contexto de
  ejecución y no se deben sobrescribir de forma silenciosa.
- **Sí:** auditar en ambas Actividades; quien consulta cualquiera de los extremos puede entender
  cuándo se creó o retiró la relación.
- **Sí:** bloquear la eliminación en ambos sentidos; retirar una relación de forma implícita
  ocultaría una decisión operativa.
- **No:** permisos nuevos de dependencia; duplicarían `activities.manage` sin una frontera de
  negocio independiente.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Una cadena amplia oculta un ciclo indirecto.                             | Validar recursivamente al insertar y rechazar cualquier arista que cierre el ciclo.                    |
| Dos personas modifican las predecesoras de una misma sucesora.           | Bloquear y comprobar su versión dentro de una única transacción; devolver `409` ante versión obsoleta. |
| La advertencia se interpreta como prohibición de finalizar.              | Indicar explícitamente que es una advertencia y mantener habilitada la acción de guardar.              |
| La eliminación deja una secuencia incompleta o difícil de explicar.      | Usar claves restrictivas, traducir el conflicto y mostrar los nombres relacionados.                    |
| Una predecesora reabierta deja una sucesora finalizada aparentemente OK. | Recalcular las pendientes al leer el detalle y mostrar la advertencia también en ese caso.             |

## Qué **no** está en esta spec

- Tipos de relación distintos de fin-a-inicio, retardos o planificación basada en fechas.
- Bloqueo automático de la finalización, motivos de excepción o reversión automática de estados.
- Dependencias entre contenedores distintos.
- Diagramas, Gantt, ruta crítica, Agenda, capacidad, Tiempo o notificaciones.
- Comentarios, archivos, adjuntos o permisos independientes de Actividad.
