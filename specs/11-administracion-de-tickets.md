# SPEC 11 — Administración de Tickets

> **Status:** Aprobada
> **Depends on:** SPEC 05, SPEC 06, SPEC 09
> **Date:** 2026-09-22
> **Objective:** Administrar Tickets externos asociados a Clientes mediante un catálogo privado con consulta y gestión autorizada, sin duplicar el ciclo de vida de su plataforma de origen.

## Por qué existe esta spec

Los Tickets representan trabajo que nace y se sigue en una plataforma externa.

Portal 360 necesita conservar su contexto y vincularlo con Actividades futuras sin reemplazar la
fuente de verdad externa.

## Alcance

**Incluye:**

- Crear la entidad persistente Ticket dentro del esquema `business`.
- Listar, buscar, filtrar por Cliente y prioridad, consultar detalle, crear, editar y eliminar
  Tickets desde la ruta privada `/tickets`.
- Guardar Cliente, referencia externa, URL externa opcional, título, descripción breve opcional y
  prioridad externa obligatoria.
- Asignar `medium` como prioridad predeterminada.
- Permitir referencias externas repetidas, incluso para un mismo Cliente.
- Permitir crear Tickets únicamente para Clientes activos.
- Conservar la consulta de Tickets de Clientes desactivados.
- Eliminar físicamente un Ticket solo si no tiene Actividades relacionadas.
- Incorporar los permisos `tickets.read` y `tickets.manage` al catálogo RBAC.
- Exponer la API bajo `/api/tickets/*` y reenviarla desde Next.js en el mismo origen.
- Mostrar la navegación de Tickets a quienes tengan `tickets.read`.
- Aplicar los componentes, estados y requisitos de accesibilidad definidos en SPEC 03 y el sistema
  visual definido en SPEC 09.
- Añadir pruebas focalizadas de migración, permisos, API, cliente web, navegación y pantallas.

**Fuera de alcance (para futuras specs):**

- Un código interno, consecutivo o configuración de códigos para Ticket.
- Estados, transiciones, cierre o reapertura del Ticket dentro de Portal 360.
- Sincronización, autenticación o integración API con plataformas externas.
- Actividades de Ticket, sus responsables, dependencias, agenda, tiempo, comentarios o auditoría.
- Borrado lógico, restauración, permisos por registro o por equipo.
- Catálogo configurable de prioridades.

## Modelo de datos y contratos

La identidad continúa en `auth.user`, la autorización en `authorization` y los datos operativos en
`business`.

La migración creará `business.ticket` con la siguiente forma física:

```text
id                  uuid primary key default gen_random_uuid()
client_id           uuid not null references business.client(id) on delete restrict
external_reference  varchar(200) not null
external_url        varchar(2048) null
title               varchar(200) not null
description         varchar(2000) null
external_priority   text not null default 'medium'
version             integer not null
created_at          timestamptz not null
created_by_user_id  text not null references auth.user(id) on delete restrict
updated_at          timestamptz not null
updated_by_user_id  text not null references auth.user(id) on delete restrict
```

Las reglas de `business.ticket` son las siguientes:

- `external_reference` se recorta antes de validarse y admite entre 1 y 200 caracteres.
- `external_reference` no tiene restricción de unicidad global ni por Cliente.
- `external_url` es opcional y, cuando existe, debe ser una URL absoluta con protocolo `http` o
  `https` y hasta 2.048 caracteres.
- `title` se recorta antes de validarse y admite entre 1 y 200 caracteres.
- `description` es opcional y admite hasta 2.000 caracteres.
- `external_priority` acepta únicamente `critical`, `high`, `medium` o `low`.
- La creación sin prioridad explícita asigna `medium`.
- El Cliente es obligatorio e inmutable después de crear el Ticket.
- La creación valida dentro de su transacción que el Cliente existe y está activo.
- `version` es un entero positivo, inicia en `1` y aumenta una vez por cada actualización exitosa.
- No existen columnas, reglas ni transiciones de estado propias de Ticket.
- La futura relación de Actividad con Ticket usará `on delete restrict`.
- La eliminación es física y se rechaza de forma controlada cuando existan Actividades relacionadas.

Los tipos y etiquetas públicas serán:

```text
TicketExternalPriority = critical | high | medium | low
```

| Identificador | Etiqueta |
| --- | --- |
| `critical` | Crítica |
| `high` | Alta |
| `medium` | Media |
| `low` | Baja |

El catálogo RBAC se amplía así:

| Permiso | Asignación inicial | Uso |
| --- | --- | --- |
| `tickets.read` | `administrador`, `lider`, `miembro` | Listar, buscar y consultar Tickets. |
| `tickets.manage` | `administrador`, `lider` | Crear, editar y eliminar Tickets sin Actividades. |

Las rutas HTTP serán:

| Método y ruta | Permiso | Comportamiento |
| --- | --- | --- |
| `GET /api/tickets` | `tickets.read` | Lista paginada, busca por referencia externa o título, filtra por Cliente y prioridad, y ordena por actualización descendente. |
| `POST /api/tickets` | `tickets.manage` | Crea un Ticket para un Cliente activo. |
| `GET /api/tickets/:ticketId` | `tickets.read` | Devuelve el detalle y la referencia visible de su Cliente. |
| `PUT /api/tickets/:ticketId` | `tickets.manage` | Actualiza datos cuando la versión coincide, sin cambiar el Cliente. |
| `DELETE /api/tickets/:ticketId` | `tickets.manage` | Elimina definitivamente un Ticket sin Actividades. |

Una solicitud sin sesión recibe `401`.

Una sesión sin el permiso requerido recibe `403`.

Una actualización que use una versión obsoleta recibe `409 Conflict` y no sobrescribe el dato
existente.

## Plan de implementación

1. Crear `apps/api/migrations/0007-business-tickets.sql` con `business.ticket`, sus restricciones,
   índices y campos técnicos; comprobar que permite referencias externas repetidas y que no altera
   datos de Cliente, Proyecto o Requerimiento.
2. Crear `apps/api/migrations/0007-authorization-tickets-permissions.sql` para incorporar los dos
   permisos de Ticket y asignarlos a los roles de sistema acordados; comprobar que es idempotente y
   no modifica permisos fuera de alcance.
3. Ampliar `apps/api/src/authorization/permissions.ts`, tipos y pruebas para reconocer
   `tickets.read` y `tickets.manage`; comprobar que el contexto de autorización los resuelve en la
   siguiente solicitud.
4. Crear `apps/api/src/tickets/tickets.contracts.ts`, `tickets.repository.ts`, `tickets.service.ts`,
   `tickets.controller.ts`, `tickets.module.ts` y sus pruebas para validar el Cliente activo, URL,
   prioridad, versión y eliminación restringida; comprobar los conflictos y respuestas controladas.
5. Registrar `TicketsModule` en `apps/api/src/app.module.ts` y aplicar los guards y decoradores de
   SPEC 05; comprobar los contratos `401`, `403`, `404`, `409` y la validación de entrada.
6. Extender `apps/web/next.config.ts` para reenviar exclusivamente `/api/tickets/:path*` al origen
   de `apps/api`; comprobar que las solicitudes preservan la sesión del mismo origen.
7. Crear `apps/web/src/lib/tickets-client.ts` y sus pruebas para los contratos de listado, detalle,
   creación, edición, filtros y eliminación; comprobar que el navegador usa solo las rutas públicas
   del mismo origen.
8. Actualizar `apps/web/src/lib/administration-navigation.ts`, sus pruebas y
   `apps/web/src/components/layout/app-sidebar.tsx` para mostrar Tickets a quien tenga
   `tickets.read`; comprobar navegación de escritorio, colapsada y móvil.
9. Crear `apps/web/src/app/(app)/tickets/page.tsx`, `ticket-management.tsx`,
   `ticket-editor-dialog.tsx` y `ticket-delete-dialog.tsx` para listado, búsqueda, filtros, detalle,
   selección de Clientes activos, creación, edición y confirmación de eliminación; comprobar carga,
   vacío, validación, error, conflicto y acceso no autorizado.
10. Añadir pruebas focalizadas de migraciones, restricciones SQL, permisos, contratos HTTP,
    navegación y flujos de interfaz; comprobar los comandos de validación definidos por el
    monorepo.

## Criterios de aceptación

- [ ] Ejecutar `corepack pnpm --filter @portal-360/api business:migrate` crea
      `business.ticket` sin modificar datos de las entidades existentes.
- [ ] Un Ticket persiste UUID, Cliente obligatorio, referencia externa, URL externa opcional,
      título, descripción opcional, prioridad externa, versión y campos técnicos.
- [ ] La referencia externa admite duplicados, incluso dentro del mismo Cliente.
- [ ] Un Ticket creado sin prioridad explícita queda con `medium`.
- [ ] La API rechaza una prioridad fuera de `critical`, `high`, `medium` y `low`.
- [ ] La API rechaza una URL externa que no sea absoluta con protocolo `http` o `https`.
- [ ] Solo se puede crear un Ticket para un Cliente activo y su Cliente no se puede cambiar después
      de crearlo.
- [ ] Los Tickets de un Cliente desactivado siguen siendo consultables, pero crear uno para ese
      Cliente recibe un error de validación controlado.
- [ ] Ningún endpoint ni formulario expone o exige un estado, cierre o código interno de Ticket.
- [ ] Administrador, Líder y Miembro pueden consultar Tickets; solo Administrador y Líder pueden
      gestionarlos; Estándar no puede acceder al módulo.
- [ ] `/tickets` pagina 25 resultados, busca por referencia externa o título, filtra por Cliente y
      prioridad, y se ordena inicialmente por actualización más reciente.
- [ ] Una actualización con `version` obsoleta no sobrescribe datos y la interfaz comunica que debe
      recargarse.
- [ ] Un Ticket sin Actividades puede eliminarse de forma definitiva y una Actividad futura con
      `on delete restrict` impide eliminarlo.
- [ ] La interfaz presenta estados de carga, vacío, error, validación, conflicto y no autorizado
      mediante los componentes accesibles definidos por SPEC 03.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`
      y `corepack pnpm format:check` finalizan con código `0` desde la raíz.

## Decisiones

- **Sí:** Ticket representa una referencia externa y no recibe código interno; evita duplicar dos
  identificadores para el mismo elemento de la plataforma de origen.
- **Sí:** la referencia externa se puede repetir; Portal 360 no asume que identificadores de
  plataformas o clientes distintos sean globalmente únicos.
- **Sí:** prioridad externa obligatoria con valor inicial `medium`; garantiza clasificación mínima
  sin impedir que la plataforma de origen use otro flujo.
- **Sí:** URL externa opcional con protocolos `http` y `https`; facilita navegar al origen sin
  obligar a que este exponga un enlace.
- **Sí:** Cliente activo e inmutable al crear; preserva el vínculo de negocio y evita abrir trabajo
  nuevo para Clientes retirados.
- **Sí:** eliminación física sin Actividades y futura relación `on delete restrict`; evita Tickets
  huérfanos sin introducir borrado lógico prematuramente.
- **No:** estado, transición o cierre interno; la plataforma externa conserva la fuente de verdad.
- **No:** integración o sincronización con la plataforma externa; el registro manual es el alcance
  del MVP.
- **No:** catálogo configurable de prioridades; los cuatro valores definidos cubren el MVP.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La referencia externa duplicada puede confundir al buscar. | Mostrar siempre Cliente, referencia y título en el listado y permitir filtrar por Cliente. |
| La prioridad en Portal 360 puede desalinearse de la plataforma externa. | Etiquetarla como prioridad externa y mantener el registro manual como alcance explícito del MVP. |
| Una Actividad futura puede permitir borrar trabajo relacionado. | Declarar desde esta spec `on delete restrict` y mapear el rechazo de base de datos a un error controlado. |
| Un enlace externo malformado puede degradar la navegación. | Validar URL absoluta y protocolos `http` o `https` en contrato y servidor. |

## Qué **no** está en esta spec

- Código interno, consecutivo o ajustes de códigos para Ticket.
- Estados, cierres, reaperturas o sincronización con una plataforma externa.
- Actividades, responsables, dependencias, agenda, tiempo, comentarios, auditoría, borrado lógico o
  restauración.
- Prioridades configurables, permisos por registro o por equipo.
