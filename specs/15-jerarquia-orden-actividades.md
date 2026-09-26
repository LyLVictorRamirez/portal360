# SPEC 15 — Jerarquía y orden de Actividades

> **Status:** Implementada
> **Depends on:** SPEC 05, SPEC 13
> **Date:** 2026-09-24
> **Objective:** Organizar las Actividades en un árbol de hasta cuatro niveles y reubicar sus subárboles mediante arrastrar y soltar accesible.

## Alcance

**Incluye:**

- Ampliar `business.activity` a cuatro niveles máximos, con raíz como nivel uno, sin ciclos y con el mismo contenedor y Etapa de Proyecto en toda la cadena.
- Mostrar `/actividades` como árbol expandible, ordenado por `position` entre hermanas, y persistir las ramas expandidas en `localStorage` bajo `portal-360:activities:expanded-v1`.
- Cargar el árbol completo del filtro activo con sus ancestros de contexto y `matchesFilter`; sobre 500 filas contextuales, pedir refinar filtros sin mostrar un resultado parcial.
- Reemplazar mover arriba/abajo por arrastre hacia antes, después o dentro de otra Actividad, y por la opción de convertir una Actividad en raíz.
- Mover la Actividad con todo su subárbol, conservar el orden interno y ofrecer acciones de teclado equivalentes con anuncios para lectores de pantalla.
- Reemplazar el ID manual de padre del Sheet Form por un selector remoto de padres válidos.
- Reubicar, actualizar posiciones y auditar las Actividades afectadas en una transacción; ante conflicto, recargar el árbol.

**Fuera de alcance (para futuras specs):**

- Dependencias jerárquicas, Gantt, ruta crítica, Agenda, capacidad o fechas derivadas.
- Mover entre contenedores o entre Etapas de un Proyecto.
- Permisos nuevos, sincronizar expansión, carga parcial, paginación o virtualización del árbol.

## Modelo de datos y contratos

No hay entidades ni columnas nuevas. Se reutilizan `business.activity.parent_activity_id` y `position`.

La migración `apps/api/migrations/0012-business-activity-hierarchy-order.sql` reemplazará la función y trigger `business.enforce_activity_hierarchy_and_stage` de SPEC 13. Validará autorrelación, ciclos directos e indirectos, profundidad máxima, coincidencia de contenedor y Etapa en todos los ancestros, e impedirá cambiar de Etapa a una Actividad con descendientes. Conservará inmutabilidad del contenedor, claves restrictivas e índices únicos actuales.

```text
ActivityTreeItem = Activity & { matchesFilter: boolean }
ActivityTree = { activities: ActivityTreeItem[] }
RelocateActivityInput = {
  targetActivityId: string | null;
  placement: before | after | inside | last;
  version: number;
}
```

`ActivityTree.activities` usa recorrido previo y el cliente lo reconstruye por `parentActivityId`. `matchesFilter: false` significa fila de contexto. `targetActivityId` es obligatorio para `before`, `after` e `inside`; solo `last` usa destino nulo y deja la Actividad como última raíz. `inside` la inserta como última hija. Antes o después la convierte en hermana. El destino no puede ser la Actividad ni un descendiente.

| Método y ruta                           | Permiso             | Comportamiento                                                                           |
| --------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| `GET /api/activities/tree`              | `activities.read`   | Árbol completo para los filtros actuales, con ancestros y máximo 500 filas contextuales. |
| `POST /api/activities/:activityId/move` | `activities.manage` | Reemplaza `{ direction, version }` por `RelocateActivityInput` y reubica un subárbol.    |

El selector de padre reutiliza `GET /api/activities` con contenedor, Etapa y búsqueda; excluye la Actividad, sus descendientes y destinos que excedan el nivel cuatro. El movimiento exige la versión de la raíz, bloquea subárbol y grupos de hermanas de origen y destino, y es todo o nada. El conflicto devuelve `409` y fuerza recarga. Destino inválido, ciclo, profundidad, contenedor o Etapa devuelven `422`; sesión ausente `401` y permiso ausente `403`. Cada padre o posición modificados genera un evento `modify` en `business.audit_event` dentro de la transacción.

## Plan de implementación

1. Crear `apps/api/migrations/0012-business-activity-hierarchy-order.sql` para sustituir el trigger y validar los cuatro niveles.
2. Extender `apps/api/src/activities/activities.contracts.ts` con el árbol y la reubicación por destino.
3. Ampliar `activities.repository.ts` para obtener árbol contextual con límite y mover subárboles con bloqueos, posiciones, versión y auditoría.
4. Actualizar `activities.service.ts` y `activities.controller.ts` con `GET /api/activities/tree`, movimiento y errores `401`, `403`, `409` y `422`.
5. Cubrir migración, repositorio, servicio y controlador: profundidad, ciclo, contenedor, Etapa, traslado, compactación, límite, auditoría y concurrencia.
6. Actualizar `apps/web/src/lib/activities-client.ts` y pruebas para árbol, reubicación, límite y recarga por conflicto.
7. Actualizar `apps/web/src/app/(app)/actividades/activity-management.tsx` y componentes para árbol, expansión local, filtros contextuales y aviso de refinar.
8. Añadir arrastre con indicadores antes/después/dentro, acciones de teclado accesibles y retirar mover arriba/abajo.
9. Actualizar `activity-sheet.tsx`, `activity-form-validation.ts` y pruebas con selector remoto de padre válido.
10. Ejecutar pruebas focalizadas y las validaciones definidas por el monorepo.

## Criterios de aceptación

- [ ] Una Actividad admite niveles uno a cuatro, nunca un quinto, una autorrelación ni un ciclo.
- [ ] Toda descendiente comparte contenedor y Etapa de Proyecto con sus ancestros; no se cambia la Etapa de una Actividad con descendientes.
- [ ] El árbol se ordena por `position`, permite expandir ramas y conserva la expansión tras recargar con `portal-360:activities:expanded-v1`.
- [ ] Los filtros incluyen ancestros, distinguen contexto y, sobre 500 filas contextuales, solicitan refinamiento sin árbol parcial.
- [ ] Se mueve un subárbol antes, después o dentro de un destino válido, o se convierte en raíz, sin alterar su orden interno.
- [ ] Las acciones de teclado equivalentes anuncian el resultado a tecnologías asistivas.
- [ ] El selector de padre excluye destinos incompatibles, descendientes y profundidades inválidas.
- [ ] Un conflicto no aplica cambios parciales, responde `409` y recarga el árbol.
- [ ] Cada cambio de padre o posición queda auditado dentro de la transacción.
- [ ] `activities.read` consulta el árbol, `activities.manage` lo reubica y lint, typecheck, test, build y format:check terminan con código `0`.

## Decisiones

- **Sí:** cuatro niveles; permiten descomposición útil sin complejidad ilimitada.
- **Sí:** mismo contenedor y Etapa; preserva el contexto de SPEC 13.
- **Sí:** arrastre con destinos explícitos y teclado; cubre interacción directa y uso sin ratón.
- **No:** botones arriba/abajo; no expresan cambios de padre.
- **Sí:** mover el subárbol completo; evita separar trabajo estructurado.
- **Sí:** árbol completo con límite 500; evita contexto incompleto y carga impredecible.
- **No:** paginación, carga parcial y permisos nuevos; no resuelven el objetivo de esta spec.
- **Sí:** `localStorage`; la expansión es una preferencia local, sin datos de cuenta.

## Riesgos

| Riesgo                                     | Mitigación                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Reordenamientos simultáneos alteran ramas. | Bloquear grupos, comprobar versión y revertir todo ante conflicto.         |
| El destino visual resulta ambiguo.         | Indicadores antes, después y dentro, con acciones de teclado equivalentes. |
| Un filtro parece ocultar contexto.         | Incluir ancestros y marcar las filas de contexto.                          |
| Un árbol grande degrada la interfaz.       | Límite de 500 filas y filtros más específicos.                             |
| Persiste la regla anterior de dos niveles. | Reemplazar trigger y cubrir la migración con pruebas.                      |

## Qué **no** está en esta spec

- Dependencias jerárquicas, diagramas, Gantt, Agenda, capacidad o planificación por fechas.
- Movimientos entre contenedores o Etapas, sincronización de expansión y carga parcial.
- Permisos nuevos, comentarios, archivos, notificaciones o estados derivados de jerarquía.
