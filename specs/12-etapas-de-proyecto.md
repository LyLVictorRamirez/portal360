# SPEC 12 — Etapas de Proyecto

> **Status:** Implementada
> **Depends on:** SPEC 05, SPEC 07, SPEC 10
> **Date:** 2026-09-22
> **Objective:** Gestionar las Etapas de un Proyecto desde su detalle para organizar secuencialmente las futuras Actividades sin introducir un ciclo de vida propio.

## Por qué existe esta spec

El modelo de dominio establece que un Proyecto contiene Etapas y que las Actividades de Proyecto
pertenecerán a una de ellas.

Portal 360 necesita permitir que la estructura de Etapas se mantenga junto al Proyecto antes de
incorporar las Actividades.

## Alcance

**Incluye:**

- Crear la entidad persistente Etapa dentro del esquema `business`.
- Incluir las Etapas, ordenadas ascendentemente, en el detalle de cada Proyecto.
- Gestionar Etapas exclusivamente desde la sección `Etapas` del diálogo actual de detalle de
  Proyecto.
- Permitir crear una Etapa después de que el Proyecto haya sido guardado.
- Permitir editar el nombre, mover una Etapa una posición hacia arriba o abajo y eliminarla.
- Añadir la nueva Etapa siempre al final del orden existente.
- Reutilizar `projects.read` para consultar Etapas y `projects.manage` para crearlas, editarlas,
  reordenarlas o eliminarlas.
- Validar concurrencia optimista con la versión vigente de la Etapa en cada modificación, movimiento
  o eliminación.
- Bloquear la gestión de Etapas cuando el Proyecto esté `finalized` o `cancelled`.
- Bloquear la eliminación de una Etapa que tenga Actividades relacionadas.
- Mantener la eliminación física del Proyecto bloqueada mientras tenga Etapas relacionadas.
- Añadir pruebas focalizadas de migración, restricciones, API, cliente web y flujo de detalle.

**Fuera de alcance (para futuras specs):**

- Crear Etapas durante el formulario de creación de un Proyecto.
- Estados, fechas, responsables, hitos, porcentaje de avance o cierre manual de una Etapa.
- Actividades, dependencias, agenda, tiempo, comentarios, archivos o auditoría consultable de una
  Etapa.
- Arrastrar y soltar, reordenamiento masivo, posiciones numéricas editables o reubicación de una
  Etapa entre Proyectos.
- Borrado lógico, restauración, permisos por Etapa o permisos por Proyecto.

## Modelo de datos y contratos

La migración `apps/api/migrations/0008-business-project-stages.sql` creará
`business.project_stage` con la siguiente forma física:

```text
id                  uuid primary key default gen_random_uuid()
project_id          uuid not null references business.project(id) on delete restrict
name                varchar(15) not null
position            integer not null
version             integer not null
created_at          timestamptz not null
created_by_user_id  text not null references auth.user(id) on delete restrict
updated_at          timestamptz not null
updated_by_user_id  text not null references auth.user(id) on delete restrict
```

La tabla tendrá una restricción única para `(project_id, position)` y una restricción única
insensible a mayúsculas para el nombre normalizado de cada Proyecto.

El nombre se recorta antes de validarse y persiste sin espacios exteriores.

El nombre admite entre 1 y 15 caracteres.

`position` es un entero positivo y representa el orden visible ascendente.

`version` es un entero positivo, inicia en `1` y aumenta en cada edición o movimiento exitoso.

Crear una Etapa se realiza dentro de una transacción que bloquea las Etapas de su Proyecto,
calcula la siguiente posición disponible y persiste la nueva fila.

Un movimiento intercambia en una única transacción la posición de la Etapa origen con la vecina
inmediata en la dirección solicitada.

El movimiento exige la versión vigente de la Etapa origen y devuelve `409 Conflict` si cambió antes
de completar la operación.

Mover hacia arriba la primera Etapa o hacia abajo la última se rechaza con validación controlada.

El detalle de Proyecto incluirá `stages`, ordenado por `position` ascendente y, como desempate
técnico, por `id` ascendente.

El contrato público de una Etapa será:

```text
ProjectStage = {
  id: string;
  name: string;
  position: number;
  version: number;
  createdAt: Date;
  createdByUserId: string;
  updatedAt: Date;
  updatedByUserId: string;
}
```

Las rutas HTTP serán:

| Método y ruta                                                   | Permiso           | Comportamiento                                                                          |
| ---------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `POST /api/projects/:projectId/stages`                          | `projects.manage` | Crea una Etapa al final de un Proyecto no terminal.                                    |
| `PUT /api/projects/:projectId/stages/:stageId`                  | `projects.manage` | Actualiza el nombre cuando coincide la versión de la Etapa.                            |
| `POST /api/projects/:projectId/stages/:stageId/move`            | `projects.manage` | Mueve una posición con cuerpo `{ direction, version }`, donde `direction` es `up/down`. |
| `DELETE /api/projects/:projectId/stages/:stageId?version=<n>`   | `projects.manage` | Elimina físicamente una Etapa sin Actividades cuando coincide su versión.              |

`GET /api/projects/:projectId` continuará protegido por `projects.read` y devolverá el Proyecto
junto con sus Etapas.

Una solicitud sin sesión recibe `401` y una sesión sin el permiso requerido recibe `403`.

## Plan de implementación

1. Crear `apps/api/migrations/0008-business-project-stages.sql` para crear
   `business.project_stage`, sus claves foráneas, restricciones de nombre y posición, índices y la
   relación futura desde Actividad; comprobar que la migración es aplicable sobre los Proyectos
   existentes sin crear Etapas artificiales.
2. Extender `apps/api/src/projects/projects.contracts.ts` con `ProjectStage`, entradas de creación,
   actualización y movimiento, contratos de detalle y errores controlados; comprobar que los
   límites de nombre, la dirección y la versión se validan antes de persistir.
3. Actualizar `apps/api/src/projects/projects.repository.ts`, `projects.service.ts` y
   `projects.controller.ts` para listar las Etapas en el detalle y realizar sus mutaciones
   transaccionales; comprobar propiedad de Etapa respecto del Proyecto, orden al crear,
   intercambio atómico, estados terminales, conflicto `409` y eliminación bloqueada por relaciones.
4. Ampliar las pruebas de repositorio, servicio y controlador de Proyecto para cubrir permisos,
   respuestas `401`, `403`, `404`, `409` y `422`, unicidad insensible a mayúsculas, límites de
   nombre, orden y reglas de eliminación.
5. Actualizar `apps/web/src/lib/projects-client.ts` y `projects-client.test.ts` para interpretar las
   Etapas del detalle y llamar a los endpoints de creación, edición, movimiento y eliminación;
   comprobar que se propaga la versión y se representa el conflicto de concurrencia.
6. Actualizar `apps/web/src/app/(app)/proyectos/project-editor-dialog.tsx` y crear los componentes
   locales de Etapas que sean necesarios para mostrar la sección en el modo de detalle; comprobar
   creación, edición, controles subir/bajar, eliminación confirmada, carga, vacío, validación,
   error y conflicto accesibles.
7. Actualizar las pruebas de los componentes de Proyecto para comprobar que solo una persona con
   `projects.manage` puede gestionar Etapas, que un Proyecto terminal las presenta en solo lectura
   y que no pueden añadirse hasta después de guardar el Proyecto.
8. Ejecutar las pruebas focalizadas de migración, Proyecto y cliente web, y comprobar los comandos
   de validación definidos por el monorepo.

## Criterios de aceptación

- [ ] La migración crea `business.project_stage` con Proyecto obligatorio, nombre, posición,
  versión y campos técnicos, sin insertar Etapas para Proyectos existentes.
- [ ] Una Etapa solo puede pertenecer a un Proyecto existente y un Proyecto con Etapas no puede
  eliminarse.
- [ ] El nombre se recorta, debe tener entre 1 y 15 caracteres y no se puede repetir en un mismo
  Proyecto aunque cambie únicamente la capitalización.
- [ ] El mismo nombre puede existir en Proyectos distintos.
- [ ] Crear una Etapa la ubica siempre después de la última Etapa del Proyecto y devuelve su versión
  inicial `1`.
- [ ] El detalle de Proyecto devuelve `stages` ordenado ascendentemente por `position`.
- [ ] Editar, mover o eliminar una Etapa exige su versión vigente y un cambio simultáneo recibe
  `409 Conflict` sin sobrescribir información.
- [ ] Subir o bajar una Etapa intercambia exactamente su orden con la vecina inmediata y conserva
  posiciones positivas y únicas.
- [ ] Intentar subir la primera Etapa o bajar la última recibe un error de validación controlado.
- [ ] Solo quien tiene `projects.manage` puede crear, editar, mover o eliminar Etapas; quien tiene
  únicamente `projects.read` puede verlas desde el detalle.
- [ ] Un Proyecto `finalized` o `cancelled` muestra sus Etapas, pero no permite crear, editar,
  mover ni eliminar ninguna.
- [ ] Una Etapa con Actividades relacionadas no puede eliminarse y recibe un error controlado.
- [ ] La sección `Etapas` se muestra en el diálogo existente de detalle y no aparece durante la
  creación de un Proyecto sin guardar.
- [ ] La interfaz comunica de forma accesible los estados de carga, vacío, validación, error y
  conflicto de concurrencia.
- [ ] Las pruebas focalizadas y `corepack pnpm lint`, `corepack pnpm typecheck`,
  `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código
  `0`.

## Decisiones

- **Sí:** una Etapa contiene únicamente Proyecto, nombre y orden de negocio; su situación futura se
  deriva de Actividades y no requiere estado, fechas ni milestone propios.
- **Sí:** la gestión se integra en el diálogo de detalle existente; mantiene las Etapas en el
  contexto del Proyecto sin abrir una ruta adicional.
- **Sí:** las Etapas solo se crean después de guardar el Proyecto; evita una creación compuesta de
  registros que todavía no tienen una relación persistida.
- **Sí:** reutilizar `projects.read` y `projects.manage`; la Etapa es una parte interna del Proyecto
  y no abre una frontera de autorización adicional.
- **Sí:** controles subir y bajar con intercambio de posiciones; expresa el orden sin números
  editables ni reordenamiento complejo.
- **Sí:** agregar una Etapa al final; proporciona un resultado determinista y deja el ajuste de
  orden a los controles explícitos.
- **Sí:** unicidad del nombre por Proyecto sin distinguir mayúsculas y tras recortar espacios;
  evita duplicados operativos como `Diseño`, `diseño` o ` Diseño `.
- **Sí:** concurrencia optimista por Etapa para edición, movimiento y eliminación; es coherente con
  el modelo actual y evita perder cambios simultáneos.
- **Sí:** bloquear la gestión de Etapas en Proyectos terminales y la eliminación cuando existan
  Actividades; preserva la integridad del trabajo ya cerrado o relacionado.
- **No:** crear permisos propios de Etapa; sería duplicar los límites de Proyecto sin un caso de
  negocio independiente.
- **No:** permitir crear Etapas desde el formulario inicial de Proyecto, arrastrar y soltar o
  modificar la posición manualmente; esas interacciones no son necesarias para la operación
  acordada.

## Riesgos

| Riesgo                                                                 | Mitigación                                                                                         |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Dos personas crean o reordenan Etapas simultáneamente.                | Usar transacciones y bloqueo por Proyecto, versión de la Etapa origen y conflictos controlados.    |
| El intercambio de posiciones vulnera la restricción de unicidad.      | Realizar el movimiento dentro de una transacción con una actualización intermedia segura y pruebas. |
| Una futura Actividad deja una Etapa que parece eliminable en la UI.   | Declarar la clave foránea restrictiva y traducir su rechazo a un error de negocio controlado.       |
| Los nombres visualmente equivalentes generan Etapas duplicadas.       | Normalizar espacios y aplicar unicidad insensible a mayúsculas en base de datos y servicio.         |

## Qué **no** está en esta spec

- Actividades de Proyecto ni su asociación física definitiva a una Etapa.
- Estados, fechas, responsables, hitos, progreso o cierres de Etapa.
- Crear Etapas antes de guardar el Proyecto, arrastrar y soltar o editar posiciones numéricas.
- Borrado lógico, restauración, auditoría consultable o permisos independientes de Etapa.
