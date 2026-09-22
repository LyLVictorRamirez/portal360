# SPEC 10 — Estados unificados de Proyectos y Requerimientos

> **Status:** Implementada
> **Depends on:** SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-09-21
> **Objective:** Unificar los nombres técnicos y visibles de los estados de Proyecto y Requerimiento, e incorporar la pausa reanudable al flujo de Requerimientos.

## Por qué existe esta spec

Proyecto usa `planned` y `active`, mientras Requerimiento usa `new`, `in_execution` y `closed`.

La diferencia expresa conceptos equivalentes con nombres distintos y dificulta la operación y la evolución de ambos módulos.

## Scope

**In:**

- Renombrar los estados técnicos y contratos de Proyecto `planned` a `new` y `active` a `in_execution`.
- Renombrar el estado técnico y contratos de Requerimiento `closed` a `finalized`.
- Mantener en Proyecto exactamente `new`, `in_execution`, `paused`, `finalized` y `cancelled`.
- Mantener en Requerimiento exactamente `new`, `in_analysis`, `quoted`, `approved`, `in_execution`, `finalized`, `paused` y `cancelled`.
- Conservar el flujo secuencial de Requerimientos `new → in_analysis → quoted → approved → in_execution → finalized`.
- Permitir pausar un Requerimiento desde cualquier estado no terminal, guardar su estado previo y retomarlo únicamente en ese estado.
- Permitir cancelar un Requerimiento desde cualquier estado no terminal, incluido `paused`, y tratar `finalized` y `cancelled` como terminales.
- Mantener en Proyecto transiciones manuales libres entre los estados no terminales `new`, `in_execution` y `paused`.
- Migrar los datos existentes sin inventar fechas ni personas de aprobación.
- Actualizar API, base de datos, filtros, formularios, etiquetas, pruebas y mensajes de validación de ambos módulos.

**Out of scope (for future specs):**

- Configurar estados o transiciones desde administración.
- Registrar un historial general de transiciones, pausas, reanudaciones o cancelaciones.
- Añadir motivo, comentario, fecha específica o responsable para una pausa o cancelación.
- Permitir reabrir un Proyecto o Requerimiento `finalized` o `cancelled`.
- Cambiar permisos, códigos, clientes asociados, fechas de negocio o reglas de eliminación.

## Modelo de datos y contratos

Esta entrega no crea una entidad nueva.

La migración `apps/api/migrations/0006-business-unified-project-and-requirement-statuses.sql` modificará las restricciones de estado y transformará los registros actuales en una transacción.

| Tabla | Estado final permitido | Migración de datos |
| --- | --- | --- |
| `business.project` | `new`, `in_execution`, `paused`, `finalized`, `cancelled` | `planned → new` y `active → in_execution`; los demás valores se conservan. |
| `business.requirement` | `new`, `in_analysis`, `quoted`, `approved`, `in_execution`, `finalized`, `paused`, `cancelled` | `closed → finalized`; los demás valores, incluidos `in_analysis`, `quoted` y `approved`, se conservan. |

`business.requirement` añadirá `paused_from_status text null`.

La columna solo puede contener `new`, `in_analysis`, `quoted`, `approved` o `in_execution`.

`paused_from_status` es obligatorio exactamente cuando `status = 'paused'` y es nulo para cualquier otro estado.

Las restricciones de fechas conservarán el mismo significado durante una pausa:

- Un Requerimiento en `quoted`, `approved`, `in_execution` o `finalized` exige `quoted_on`.
- Un Requerimiento en `approved`, `in_execution` o `finalized` exige `approved_on` y `approved_by_user_id`.
- Un Requerimiento `paused` exige esas fechas cuando `paused_from_status` sea un estado que ya las requería.

La migración no convertirá `in_analysis`, `quoted` ni `approved` a `in_execution` porque los dos primeros pueden carecer de información de aprobación válida.

Los tipos y contratos públicos usarán los mismos identificadores técnicos persistidos:

```text
ProjectStatus = new | in_execution | paused | finalized | cancelled
RequirementStatus = new | in_analysis | quoted | approved | in_execution | finalized | paused | cancelled
```

Las etiquetas visibles en español serán:

| Identificador | Etiqueta |
| --- | --- |
| `new` | Nuevo |
| `in_analysis` | En análisis |
| `quoted` | Cotizado |
| `approved` | Aprobado |
| `in_execution` | En ejecución |
| `finalized` | Finalizado |
| `paused` | Pausado |
| `cancelled` | Cancelado |

## Plan de implementación

1. Crear `apps/api/migrations/0006-business-unified-project-and-requirement-statuses.sql` para reemplazar las restricciones de estado, migrar `planned`, `active` y `closed`, añadir `paused_from_status` y validar la coherencia entre pausa, estado anterior, fechas y aprobación; comprobar que registros intermedios existentes de Requerimiento no reciben datos inventados.
2. Actualizar `apps/api/src/projects/projects.contracts.ts`, `projects.service.ts`, `projects.repository.ts` y `projects.controller.ts` para aceptar y emitir únicamente los cinco estados de Proyecto unificados; comprobar que una creación sin estado inicia en `new` y que los estados terminales no aceptan cambios posteriores.
3. Actualizar las pruebas de contratos, servicio, repositorio y controlador de Proyecto para cubrir la migración semántica, filtros, validación HTTP, valor inicial, transiciones no terminales y rechazo de cambios desde `finalized` o `cancelled`.
4. Actualizar `apps/api/src/requirements/requirements.contracts.ts`, `requirements.repository.ts`, `requirements.service.ts` y `requirements.controller.ts` para persistir `pausedFromStatus`, exponerlo en lectura y aplicar el flujo secuencial, pausa, reanudación y cancelación acordados; comprobar que una reanudación solo puede volver al estado guardado.
5. Actualizar las pruebas de contratos, servicio, repositorio y controlador de Requerimiento para cubrir `closed → finalized`, los filtros y mensajes de validación, la preservación de fechas y aprobación durante una pausa, la cancelación desde pausa y la inmutabilidad de los estados terminales.
6. Actualizar `apps/web/src/lib/projects-client.ts`, `projects-client.test.ts`, `requirements-client.ts` y `requirements-client.test.ts` para reflejar los contratos públicos de estado y validar las respuestas de API modificadas.
7. Actualizar `apps/web/src/app/(app)/proyectos/project-management.tsx`, `project-editor-dialog.tsx` y sus pruebas para mostrar las etiquetas unificadas, iniciar los formularios en `Nuevo` y limitar las opciones de registros terminales.
8. Actualizar `apps/web/src/app/(app)/requerimientos/requirement-management.tsx`, `requirement-editor-dialog.tsx` y sus pruebas para mostrar `Finalizado` y `Pausado`, ofrecer solo las transiciones permitidas y comunicar que reanudar restituye el estado previo.
9. Ejecutar las pruebas focalizadas de migraciones, Proyecto, Requerimiento y clientes web, y comprobar los comandos de validación definidos por el monorepo.

## Criterios de aceptación

- [ ] La migración transforma cada Proyecto `planned` en `new` y cada Proyecto `active` en `in_execution` sin alterar sus demás campos.
- [ ] La migración transforma cada Requerimiento `closed` en `finalized` sin alterar sus demás campos.
- [ ] La migración conserva los Requerimientos existentes en `in_analysis`, `quoted` y `approved` sin asignar fechas o personas de aprobación artificiales.
- [ ] La base de datos y la API rechazan los valores técnicos reemplazados `planned`, `active` y `closed`.
- [ ] La creación de un Proyecto sin estado produce un registro `new`.
- [ ] Un Proyecto solo acepta `new`, `in_execution`, `paused`, `finalized` o `cancelled` y no permite modificar su estado después de `finalized` o `cancelled`.
- [ ] Un Requerimiento solo acepta los ocho estados definidos en esta spec.
- [ ] Un Requerimiento avanza únicamente por la secuencia principal definida, salvo la pausa y cancelación desde un estado no terminal.
- [ ] Al pausar un Requerimiento, `paused_from_status` guarda exactamente su estado previo y se conservan sus fechas y aprobación existentes.
- [ ] Un Requerimiento pausado solo puede reanudarse en el valor de `paused_from_status` o cancelarse.
- [ ] Al reanudar un Requerimiento, `paused_from_status` queda nulo y el estado restaurado conserva las reglas de fechas y aprobación que le corresponden.
- [ ] `finalized` y `cancelled` no aceptan transiciones posteriores para Proyecto ni Requerimiento.
- [ ] Los listados, filtros, detalles y formularios de Proyecto y Requerimiento muestran las etiquetas en español acordadas y no exponen etiquetas antiguas.
- [ ] Las pruebas focalizadas y `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código `0`.

## Decisiones

- **Sí:** `new`, `in_execution`, `paused`, `finalized` y `cancelled` para Proyecto; elimina los términos equivalentes `planned` y `active` sin introducir estados comerciales propios de Requerimientos.
- **Sí:** conservar para Requerimiento los estados `in_analysis`, `quoted` y `approved`; representan etapas necesarias del flujo de solicitud, cotización y aprobación.
- **Sí:** `finalized` reemplaza `closed`; el término es común con Proyecto y la etiqueta de negocio será `Finalizado`.
- **Sí:** añadir `paused` a Requerimiento y conservar su estado previo en `paused_from_status`; permite interrumpir el flujo sin perder el punto exacto de reanudación.
- **Sí:** `finalized` y `cancelled` son terminales en ambas entidades; evita reaperturas implícitas sin un proceso de negocio definido.
- **No:** migrar los estados intermedios de Requerimiento a `in_execution`; `in_analysis` y `quoted` pueden no tener la aprobación obligatoria para ejecución y migrarlos inventaría datos.
- **No:** historial de estados o datos adicionales de pausa; la columna de reanudación cubre la regla operativa actual sin abrir una auditoría nueva.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una restricción nueva invalida Requerimientos históricos intermedios. | Migrar solo `closed → finalized`, conservar los estados intermedios y comprobar la migración con registros de cada estado. |
| Una pausa elimina o contradice fechas y aprobación previas. | Validar en servicio y base de datos según `paused_from_status`, y probar pausa y reanudación desde cada etapa aplicable. |
| Clientes de API antiguos envían identificadores reemplazados. | Rechazar explícitamente los valores obsoletos con validación controlada y actualizar los clientes web del monorepo en la misma entrega. |

## Qué **no** está en esta spec

- Un editor administrativo del catálogo de estados o de sus transiciones.
- Reapertura de registros terminales.
- Motivos, responsables o historial consultable de pausas y cancelaciones.
- Cambios a los permisos, códigos o relaciones de Proyecto y Requerimiento.
