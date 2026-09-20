# SPEC 08 — Catálogo de Requerimientos

> **Status:** Aprobada
> **Depends on:** SPEC 03, SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-09-19
> **Objective:** Incorporar Requerimientos asociados de forma inmutable a un Cliente, con códigos configurables, un ciclo de estado controlado y administración autorizada.

## Por qué existe esta spec

Un Requerimiento representa una solicitud de un Cliente que debe analizarse, cotizarse y aprobarse antes de ejecutarse.

Portal 360 ya administra Clientes, Proyectos y sus códigos, pero aún no puede registrar este flujo de trabajo independiente de los Proyectos.

Esta entrega crea solamente el catálogo de Requerimientos.

## Scope

**In:**

- Ampliar `business.entity_code_settings` con una fila fija `requirement`, conservando las filas y consecutivos existentes de Cliente y Proyecto.
- Inicializar el código de Requerimiento con prefijo `REQ`, longitud alfanumérica `6` y consecutivo `1`, de modo que la primera emisión sea `REQ-001`.
- Permitir configurar de forma independiente el prefijo, la longitud y el consecutivo de Requerimiento desde `/administracion/configuracion/codigos`.
- Persistir Requerimiento con UUID, código visible generado e inmutable, Cliente obligatorio, nombre, descripción, estado, fechas de solicitud, compromiso, cotización y aprobación, versión y campos técnicos.
- Registrar de forma inmutable la persona que aprobó el Requerimiento cuando este pasa por primera vez a `approved`.
- Crear Requerimientos solo para Clientes activos, sin permitir cambiar su Cliente posteriormente, y conservar la consulta de los existentes cuando el Cliente se desactive.
- Aplicar el flujo de estados `new → in_analysis → quoted → approved → in_execution → closed`, con `cancelled` como salida alternativa desde cualquier estado no terminal.
- Incorporar los permisos `requirements.read`, `requirements.manage` y `requirements.settings.manage` al catálogo RBAC.
- Exponer la API bajo `/api/requirements/*` y reenviarla desde Next.js en el mismo origen.
- Crear la ruta privada `/requerimientos`, su navegación condicionada por permiso y la sección autorizada de Requerimientos en la pantalla única de códigos.
- Usar los componentes, estados y requisitos de accesibilidad definidos en SPEC 03.
- Añadir pruebas focalizadas de migración, códigos, reglas de fechas y estados, autorización, API y pantallas.

**Out of scope (for future specs):**

- Actividades de Requerimiento, sus responsables, dependencias, agenda, tiempo, comentarios o cualquier relación operativa posterior.
- Auditoría general o historial consultable de cambios de estado.
- Adjuntos, cotizaciones como documentos, presupuestos, facturación, contratos o aprobación documental.
- Edición manual de códigos emitidos, restauración, borrado lógico o una bitácora histórica general de negocio.
- Configuración de estados de Requerimiento, transiciones alternativas, permisos por registro o visibilidad por equipo.

## Modelo de datos y configuración

La identidad continúa en `auth.user`, la autorización en `authorization` y los datos operativos en `business`.

La migración ampliará `business.entity_code_settings` para aceptar exactamente `client`, `project` y `requirement`.

| Tabla                           | Campos principales                                                                                                                                                | Reglas                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `business.entity_code_settings` | `entity_type`, `prefix`, `code_length`, `next_sequence`, `version`, `created_at`, `created_by_user_id`, `updated_at`, `updated_by_user_id`                      | `entity_type` es la clave primaria y tiene una fila independiente para cada entidad fija.                                       |
| `business.requirement`          | `id`, `client_id`, `code`, `name`, `description`, `status`, `requested_on`, `committed_on`, `quoted_on`, `approved_on`, `approved_by_user_id`, `version`, campos técnicos | UUID interno, Cliente obligatorio e inmutable, código único e inmutable y concurrencia optimista por `version`.                |
| `business.schema_migration`     | `name`, `applied_at`                                                                                                                                            | Registra la migración de negocio según la infraestructura de SPEC 06.                                                           |

La fila `requirement` se sembrará con `prefix = 'REQ'`, `code_length = 6` y `next_sequence = 1`.

La configuración conserva las reglas existentes para Cliente y Proyecto:

- `prefix` acepta de 1 a 10 caracteres alfanuméricos en mayúscula.
- `code_length` representa la longitud alfanumérica total, sin contar el guion, y acepta de 3 a 20.
- La longitud del prefijo debe ser menor que `code_length`.
- El código se forma como `<prefix>-<consecutivo con ceros a la izquierda>`.
- Cada creación bloquea solo la fila de su `entity_type`, reserva el consecutivo y crea el registro en una misma transacción.
- Una actualización de configuración solo afecta emisiones futuras, exige la `version` vigente y no puede reducir `next_sequence`.
- Cuando el consecutivo ya no cabe, la creación se rechaza de forma controlada hasta ampliar la longitud.

`business.requirement` tendrá la siguiente forma física:

```text
id                  uuid primary key default gen_random_uuid()
client_id           uuid not null references business.client(id) on delete restrict
code                varchar(21) not null unique
name                varchar(200) not null
description         varchar(2000) null
status              text not null
requested_on        date not null
committed_on        date null
quoted_on           date null
approved_on         date null
approved_by_user_id text null references auth.user(id) on delete restrict
version             integer not null
created_at          timestamptz not null
created_by_user_id  text not null references auth.user(id) on delete restrict
updated_at          timestamptz not null
updated_by_user_id  text not null references auth.user(id) on delete restrict
```

Las reglas de `business.requirement` son las siguientes:

- `name` se recorta antes de validarse, admite entre 1 y 200 caracteres y puede repetirse.
- `description` es opcional y admite hasta 2.000 caracteres.
- `requested_on` es obligatorio.
- `committed_on`, `quoted_on` y `approved_on`, cuando existan, no pueden ser anteriores a `requested_on`.
- `status` solo acepta `new`, `in_analysis`, `quoted`, `approved`, `in_execution`, `closed` o `cancelled`.
- La creación siempre inicia en `new`.
- Solo se permiten las transiciones directas `new → in_analysis`, `in_analysis → quoted`, `quoted → approved`, `approved → in_execution` e `in_execution → closed`.
- Cualquier estado no terminal puede pasar a `cancelled`; `closed` y `cancelled` son terminales.
- Estar en `quoted`, `approved`, `in_execution` o `closed` exige `quoted_on`.
- Estar en `approved`, `in_execution` o `closed` exige `approved_on` y `approved_by_user_id`.
- Al realizar la transición `quoted → approved`, la API asigna `approved_by_user_id` a la persona autenticada y conserva ese valor como inmutable.
- No se conserva una tabla de historial ni se generan eventos de auditoría por cambios de estado.
- `version` es un entero positivo, inicia en `1` y aumenta una vez por cada actualización exitosa.
- La creación valida dentro de su transacción que el Cliente existe y está activo.
- La eliminación es física y solo se permite mientras no existan relaciones; una futura relación de Actividad con Requerimiento deberá declarar `on delete restrict`.

El catálogo RBAC se amplía así:

| Permiso                        | Asignación inicial                  | Uso                                                                  |
| ------------------------------ | ----------------------------------- | -------------------------------------------------------------------- |
| `requirements.read`            | `administrador`, `lider`, `miembro` | Listar, buscar y consultar Requerimientos.                           |
| `requirements.manage`          | `administrador`, `lider`            | Crear, editar, cambiar estado y eliminar Requerimientos sin relaciones. |
| `requirements.settings.manage` | `administrador`                     | Consultar y modificar la configuración del código de Requerimiento.  |

Las rutas HTTP serán:

| Método y ruta                         | Permiso                        | Comportamiento                                                                                                 |
| ------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/requirements`               | `requirements.read`            | Lista paginada, busca por código o nombre, filtra por Cliente y estado, y ordena por actualización descendente. |
| `POST /api/requirements`              | `requirements.manage`          | Crea un Requerimiento en `new` para un Cliente activo y reserva su código.                                    |
| `GET /api/requirements/:requirementId`| `requirements.read`            | Devuelve el detalle y la referencia visible de su Cliente.                                                     |
| `PUT /api/requirements/:requirementId`| `requirements.manage`          | Actualiza datos o realiza una transición válida cuando la versión coincide.                                    |
| `DELETE /api/requirements/:requirementId` | `requirements.manage`       | Elimina definitivamente un Requerimiento sin relaciones.                                                       |
| `GET /api/requirements/settings/code` | `requirements.settings.manage` | Devuelve únicamente la fila `requirement` de configuración de códigos.                                        |
| `PUT /api/requirements/settings/code` | `requirements.settings.manage` | Actualiza solo esa fila con concurrencia optimista.                                                             |

Una solicitud sin sesión recibe `401`.

Una sesión sin el permiso requerido recibe `403`.

Una actualización que use una versión obsoleta recibe `409 Conflict` y no sobrescribe el dato existente.

## Plan de implementación

1. Crear `apps/api/migrations/0005-business-requirements-and-code-settings.sql` para ampliar `business.entity_code_settings`, conservar las filas `client` y `project`, sembrar `requirement` con `REQ-001` y crear `business.requirement` con sus restricciones e índices; comprobar que no se alteran códigos ni consecutivos existentes.
2. Crear `apps/api/migrations/0005-authorization-requirements-permissions.sql` para incorporar los tres permisos de Requerimiento y asignarlos a los roles de sistema acordados; comprobar que es idempotente y no modifica permisos fuera de alcance.
3. Ampliar `apps/api/src/authorization/permissions.ts`, tipos y pruebas para reconocer los permisos de Requerimiento; comprobar que el contexto de autorización los resuelve en la siguiente solicitud.
4. Crear `apps/api/src/requirements/requirements.contracts.ts`, `requirements.repository.ts`, `requirements.service.ts`, `requirements.controller.ts`, `requirements.module.ts` y sus pruebas para reservar el código `requirement`, validar el Cliente activo, fechas, versión y transiciones, registrar la aprobación y aplicar operaciones de Requerimiento; comprobar concurrencia, conflicto y estados terminales.
5. Registrar `RequirementsModule` en `apps/api/src/app.module.ts` y aplicar los guards y decoradores de SPEC 05; comprobar los contratos `401`, `403`, `404`, `409`, validación de fechas y eliminación bloqueada por relaciones.
6. Extender `apps/web/next.config.ts` para reenviar exclusivamente `/api/requirements/:path*` al origen de `apps/api`; comprobar que las solicitudes preservan la sesión del mismo origen.
7. Crear `apps/web/src/lib/requirements-client.ts` y pruebas para los contratos de listado, detalle, creación, edición, filtros, transiciones y configuración de código; comprobar que el navegador solo consume la ruta pública del mismo origen.
8. Actualizar `apps/web/src/lib/administration-navigation.ts`, sus pruebas y `apps/web/src/components/layout/app-sidebar.tsx` para mostrar `Requerimientos` a quien tenga `requirements.read` y mostrar la sección de códigos solo con `requirements.settings.manage`; comprobar navegación de escritorio, colapsada y móvil.
9. Crear `apps/web/src/app/(app)/requerimientos/page.tsx`, `requirement-management.tsx`, `requirement-editor-dialog.tsx` y `requirement-delete-dialog.tsx` para listado, búsqueda, filtros, detalle, selección de Clientes activos, creación, edición, transición de estado y confirmación de eliminación; comprobar carga, vacío, validación, error, conflicto y acceso no autorizado.
10. Actualizar `apps/web/src/app/(app)/administracion/configuracion/codigos/page.tsx`, `code-settings-management.tsx`, `code-settings-section.tsx` y sus pruebas para presentar la sección de Requerimiento junto a Cliente y Proyecto; comprobar que cada persona ve y consulta exclusivamente las secciones para las que tiene permiso.
11. Añadir pruebas focalizadas de migraciones, restricciones SQL, reserva de consecutivos, permisos, contratos HTTP, navegación y flujos de interfaz; comprobar que los comandos de validación del monorepo siguen siendo ejecutables.

## Criterios de aceptación

- [ ] Ejecutar `corepack pnpm --filter @portal-360/api business:migrate` conserva las filas de código de Cliente y Proyecto, crea la fila `requirement` y crea `business.requirement` sin modificar códigos emitidos.
- [ ] La configuración inicial `REQ`, longitud `6` y consecutivo `1` genera `REQ-001` para el primer Requerimiento.
- [ ] Dos creaciones simultáneas de Requerimientos no reciben el mismo código y no bloquean innecesariamente las secuencias de Cliente o Proyecto.
- [ ] Quien tenga `requirements.settings.manage` puede cambiar prefijo, longitud y siguiente consecutivo de Requerimiento sin reescribir códigos existentes.
- [ ] `business.requirement` conserva UUID, Cliente obligatorio, código único e inmutable, nombre, descripción opcional, estado, fechas, aprobación, versión y campos técnicos vinculados a `auth.user`.
- [ ] Solo se puede crear un Requerimiento para un Cliente activo y su Cliente no se puede cambiar después de crearlo.
- [ ] Los Requerimientos de un Cliente desactivado siguen siendo consultables, pero crear otro para ese Cliente recibe un error de validación controlado.
- [ ] El flujo solo permite las transiciones directas definidas y `cancelled` desde un estado no terminal; `closed` y `cancelled` no aceptan transiciones posteriores.
- [ ] Un Requerimiento en `quoted` o un estado posterior tiene `quoted_on`, y uno en `approved` o posterior tiene `approved_on` y conserva quién lo aprobó.
- [ ] Ninguna fecha opcional puede ser anterior a `requested_on`.
- [ ] Los cambios de estado no crean un historial ni una auditoría general consultable.
- [ ] `Administrador` y `Líder` pueden gestionar Requerimientos; `Miembro` puede solo consultarlos; `Estándar` no puede acceder al módulo.
- [ ] Solo quien tiene `requirements.settings.manage` puede leer o modificar la configuración de Requerimiento, inicialmente solo Administrador.
- [ ] `/administracion/configuracion/codigos` muestra exclusivamente las secciones autorizadas de Cliente, Proyecto y Requerimiento, y la API no devuelve una sección sin su permiso específico.
- [ ] `/requerimientos` pagina 25 resultados, busca por código o nombre, filtra por Cliente y estado, y se ordena inicialmente por actualización más reciente.
- [ ] Una actualización con `version` obsoleta no sobrescribe datos y la interfaz comunica que debe recargarse.
- [ ] Un Requerimiento sin relaciones puede eliminarse de forma definitiva y una relación futura con `on delete restrict` impide eliminarlo.
- [ ] La interfaz presenta estados de carga, vacío, error, validación, conflicto y no autorizado mediante los componentes accesibles de SPEC 03.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** una tercera fila fija `requirement` en `business.entity_code_settings`; reutiliza la infraestructura probada de códigos sin convertirla en un motor abierto de entidades.
- **Sí:** `REQ-001` como primera emisión; identifica Requerimientos de forma consistente con `CLI-001` y `PRY-001`.
- **Sí:** una sección de Requerimientos en `/administracion/configuracion/codigos`; concentra las configuraciones de las entidades existentes y mantiene sus permisos separados.
- **Sí:** `requirements.settings.manage`, inicialmente solo para Administrador; la configuración de código funciona igual que la de Cliente y Proyecto y requiere mínimo privilegio.
- **Sí:** Cliente activo e inmutable al crear; preserva el vínculo de la solicitud y evita abrir nuevo trabajo para Clientes retirados.
- **Sí:** código inmutable y UUID interno; el código sirve a la operación y el UUID soporta futuras relaciones.
- **Sí:** flujo de estados estricto y secuencial con cancelación como salida alternativa; expresa el ciclo acordado sin transiciones implícitas o retrocesos.
- **Sí:** fechas de cotización y aprobación obligatorias desde sus estados respectivos, y aprobación atribuida a la persona autenticada; conserva la información de negocio necesaria sin implementar historial.
- **No:** historial de cambios de estado o auditoría general; no aporta valor al alcance actual y requiere una spec independiente si se necesita.
- **No:** Actividades, cotizaciones documentales, presupuestos o facturación; son capacidades posteriores del proceso de trabajo y comercial.
- **Sí:** eliminación física sin relaciones y futuras claves foráneas `on delete restrict`; evita registros huérfanos sin introducir borrado lógico o restauración antes de necesitarlos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración de configuraciones puede alterar la emisión vigente de Cliente o Proyecto. | Ejecutar el cambio en una transacción, preservar las filas existentes y cubrir la migración y las emisiones posteriores con pruebas. |
| Dos Requerimientos concurrentes podrían usar el mismo consecutivo. | Bloquear solo la fila `requirement`, mantener la restricción única sobre `code` y probar creaciones simultáneas. |
| Una transición inválida puede dejar fechas de cotización o aprobación incoherentes. | Validar centralmente el grafo de estados, las fechas y la atribución de aprobación en el servicio antes de persistir. |
| Un usuario con acceso a una configuración obtiene valores de otra entidad. | Proteger cada endpoint por su permiso específico y solicitar desde la pantalla únicamente sus secciones autorizadas. |
| Una Actividad futura permitiría eliminar un Requerimiento con trabajo relacionado. | Declarar desde esta spec la futura relación con `on delete restrict` y mapear el rechazo de base de datos a un error controlado. |

## Qué **no** está en esta spec

- Actividades, responsables, agenda, tiempo, comentarios, dependencias o trazabilidad operativa de Requerimientos.
- Historial de estados, auditoría general, adjuntos, cotizaciones documentales, presupuestos, facturación o contratos.
- Estados configurables, transiciones reversibles, permisos por registro o por equipo.
- Edición manual de códigos, borrado lógico, restauración o un motor de códigos abierto a otras entidades.
