# Entidades y campos propuestos

> Consolidación de las decisiones tomadas durante el descubrimiento. Se incluyen únicamente campos y relaciones propuestos conceptualmente; los pendientes se señalan sin inventarlos.

## Modelo general

**Cliente → [Proyecto | Requerimiento | Ticket] → Actividad**

Para proyectos: **Cliente → Proyecto → Etapa → Actividad**.

Una Actividad puede tener padre, dependencias, Bloques de Agenda, Registros de Tiempo y Comentarios. La condición Obligatorio/Opcional pertenece conceptualmente a Actividad + Semana.

## Cliente

| Campo                  | Definición                 |
| ---------------------- | -------------------------- |
| Código / identificador | Identificador del cliente. |
| Nombre                 | Nombre del cliente.        |
| Estado                 | Activo / Inactivo.         |

Tiene Proyectos, Requerimientos y Tickets. Existe un cliente interno para trabajo de la propia empresa. No se definieron contactos, segmentación ni capacidades CRM.

## Proyecto

| Campo                                | Definición                  |
| ------------------------------------ | --------------------------- |
| Cliente                              | Obligatorio.                |
| Código / identificador               | Identificador del Proyecto. |
| Nombre                               | Nombre.                     |
| Descripción / objetivo               | Objetivo general.           |
| Fecha de inicio                      | Explícita.                  |
| Fecha final comprometida con cliente | Compromiso final.           |
| Estado                               | Estado manual simple.       |

Estados conceptualmente definidos: **Planeado, Activo, Pausado, Finalizado, Cancelado**.

Tiene Etapas. No requiere un responsable/líder único ni porcentaje manual de avance.

## Etapa de Proyecto

| Campo / propiedad | Definición           |
| ----------------- | -------------------- |
| Proyecto          | Obligatorio.         |
| Nombre            | Identifica la Etapa. |
| Orden             | Organiza las Etapas. |

Tiene Actividades. Varias Etapas pueden estar activas simultáneamente. No existe una única Etapa actual, estado manual de cierre, fechas obligatorias ni milestone propio. Su situación se deriva de sus Actividades.

## Requerimiento

| Campo                           | Definición                                             |
| ------------------------------- | ------------------------------------------------------ |
| Cliente                         | Obligatorio.                                           |
| Código / identificador          | Identificador.                                         |
| Nombre                          | Nombre.                                                |
| Descripción                     | Solicitud.                                             |
| Estado                          | Estado del ciclo del Requerimiento.                    |
| Fecha de ingreso / solicitud    | Fecha de entrada.                                      |
| Fecha de compromiso con cliente | Cuando exista compromiso.                              |
| Fecha de cotización             | Fecha asociada a la cotización.                        |
| Fecha de aprobación             | Fecha de autorización.                                 |
| Quién registró / aprobó         | Conceptualmente requerido; semántica exacta pendiente. |

Estados: **Nuevo → En análisis → Cotizado → Aprobado → En ejecución → Cerrado**, con **Cancelado** como salida alternativa.

Tiene una o más Actividades.

## Ticket

| Campo                              | Definición                        |
| ---------------------------------- | --------------------------------- |
| Cliente                            | Obligatorio.                      |
| Identificador / referencia externa | Referencia en plataforma externa. |
| URL externa                        | Enlace cuando exista.             |
| Título                             | Título.                           |
| Descripción breve                  | Contexto del trabajo.             |
| Prioridad externa                  | Prioridad del Ticket externo.     |

Tiene una o más Actividades. No tiene estado ni cierre propio en LyL Control. La plataforma externa sigue siendo fuente de verdad. En MVP la referencia es manual.

## Actividad

| Campo                           | Definición                                     |
| ------------------------------- | ---------------------------------------------- |
| Nombre                          | Nombre.                                        |
| Descripción                     | Detalle.                                       |
| Contenedor de trabajo           | Obligatorio: Proyecto, Requerimiento o Ticket. |
| Etapa                           | Cuando corresponde a Proyecto.                 |
| Actividad padre                 | Opcional.                                      |
| Responsable                     | Exactamente una Persona.                       |
| Estado                          | Estado operativo.                              |
| Prioridad                       | Prioridad.                                     |
| Categoría                       | Obligatoria, selección única.                  |
| Estimación total                | Horas totales esperadas.                       |
| Fecha objetivo interna          | Fecha interna.                                 |
| Es entregable al cliente        | Sí / No explícito.                             |
| Fecha de compromiso con cliente | Solo si es entregable.                         |
| Orden / secuencia               | Orden visual/operativo; no es dependencia.     |

Estados: **Pendiente, En progreso, En revisión, Pruebas cliente, Bloqueada, Esperando tercero, Finalizada**.

Prioridades: **Crítica, Alta, Media, Baja**.

Categorías iniciales: **Desarrollo, Pruebas, Reuniones, Consultoría, Documentación, Soporte, Estabilización**. El catálogo es configurable por Administrador.

### Datos de Bloqueada

- Motivo de bloqueo: obligatorio.
- Fecha de inicio: automática.
- Dependencia relacionada: cuando corresponda.

### Datos de Esperando tercero

- Motivo.
- Esperando a: Cliente / Proveedor / Otro.
- Fecha de inicio: automática.

### Jerarquía

Máximo dos niveles: padre + hija. Una hija no puede tener hijas. Las hijas son Actividades completas. Debe evitarse doble conteo padre/hijas.

## Dependencia entre Actividades

| Campo / relación      | Definición                   |
| --------------------- | ---------------------------- |
| Actividad dependiente | La que declara “Depende de”. |
| Actividad precedente  | La Actividad requerida.      |

Puede haber múltiples dependencias. No existe tipo de dependencia en MVP ni se permiten ciclos. Se resuelve cuando la precedente queda Finalizada.

Un Miembro no puede finalizar con dependencias pendientes. Líder/Coordinador y Administrador pueden continuar tras advertencia, con motivo obligatorio y auditoría.

## Persona / Usuario

Campos conceptualmente establecidos:

| Campo / propiedad              | Definición                                     |
| ------------------------------ | ---------------------------------------------- |
| Identidad Microsoft Entra ID   | Vínculo con identidad corporativa.             |
| Nombre                         | Identificación visible.                        |
| Correo / identidad corporativa | Asociado a la cuenta corporativa.              |
| Rol                            | Administrador, Líder/Coordinador o Miembro.    |
| Estado de acceso               | Habilitado/deshabilitado sin perder historial. |

El modelo completo se dejó para la Spec de autenticación/usuarios. Consultor y Desarrollador son perfiles de trabajo, no roles de permisos.

## Horario Corporativo

Horario identificado:

| Día       | Jornada                   |
| --------- | ------------------------- |
| Lunes     | 08:00–13:00 / 14:00–17:00 |
| Martes    | 08:00–13:00 / 14:00–18:00 |
| Miércoles | 08:00–13:00 / 14:00–17:00 |
| Jueves    | 08:00–13:00 / 14:00–18:00 |
| Viernes   | 08:00–13:00 / 14:00–17:00 |

Conceptualmente debe representar día de semana, hora de inicio y hora de fin, admitiendo varias franjas por día. El diseño físico no está cerrado.

## Horario Personal

| Campo / propiedad  | Definición                                          |
| ------------------ | --------------------------------------------------- |
| Persona            | Obligatoria.                                        |
| Vigencia           | Periodo durante el cual aplica, cuando corresponda. |
| Franjas de horario | Ajuste/override del horario corporativo.            |

Representación física y vigencias exactas pendientes de Spec.

## Ausencia

| Campo            | Definición             |
| ---------------- | ---------------------- |
| Persona          | Obligatoria.           |
| Fecha desde      | Inicio.                |
| Fecha hasta      | Fin.                   |
| Tipo de ausencia | Catálogo configurable. |
| Motivo / nota    | Opcional.              |

El horario aplicable determina las ventanas laborales afectadas. Ausencias parciales se manejan mediante indisponibilidad/Bloque de Agenda con fecha y hora.

## Tipo de Ausencia

Catálogo configurable por Administrador.

| Campo  | Definición          |
| ------ | ------------------- |
| Nombre | Identifica el tipo. |

Otros campos del catálogo no fueron definidos.

## Bloque de Agenda

| Campo             | Definición                             |
| ----------------- | -------------------------------------- |
| Persona           | Obligatoria.                           |
| Fecha/hora inicio | Obligatoria.                           |
| Fecha/hora fin    | Obligatoria.                           |
| Duración          | Calculada.                             |
| Actividad         | Opcional.                              |
| Tipo / propósito  | Trabajo u ocupación según corresponda. |
| Nota              | Opcional.                              |

Puede pertenecer a una Persona distinta del responsable de la Actividad. Se permiten solapamiento, sobrecapacidad y fuera de horario con advertencia.

## Tipo de Bloque de Agenda sin Actividad

Catálogo configurable por Administrador.

| Campo  | Definición                 |
| ------ | -------------------------- |
| Nombre | Nombre del tipo de bloque. |

Los valores iniciales y atributos adicionales no se cerraron.

## Condición Semanal de Actividad

Metadato conceptual **Actividad + Semana**.

| Campo            | Definición              |
| ---------------- | ----------------------- |
| Actividad        | Obligatoria.            |
| Semana / periodo | Semana aplicable.       |
| Condición        | Obligatorio / Opcional. |

Las horas planificadas se derivan de Agenda y no se guardan aquí. Obligatorio es independiente de Prioridad.

## Registro de Tiempo

| Campo                      | Definición                |
| -------------------------- | ------------------------- |
| Actividad                  | Obligatoria.              |
| Persona                    | Quien realizó el trabajo. |
| Fecha                      | Fecha del trabajo.        |
| Horas reales               | Tiempo trabajado.         |
| Nota                       | Opcional.                 |
| Bloque de Agenda de origen | Opcional.                 |

Puede originarse en Agenda o directamente en Actividad. Sin Agenda implica trabajo no planificado. Registrar tiempo no cambia automáticamente el estado.

## Comentario

| Campo               | Definición           |
| ------------------- | -------------------- |
| Autor               | Persona creadora.    |
| Fecha/hora          | Momento de creación. |
| Texto               | Contenido.           |
| Menciones           | Opcionales.          |
| Entidad relacionada | Entidad comentada.   |

Es transversal. No sustituye la nota de Tiempo. Sin threads, reacciones ni chat en MVP. Adjuntos quedan después.

## Mención

| Campo / relación   | Definición         |
| ------------------ | ------------------ |
| Comentario         | Comentario origen. |
| Persona mencionada | Destinatario.      |

Una mención genera una Notificación interna.

## Notificación Interna

Se confirmó su existencia, pero no su modelo completo. Conceptualmente tiene:

- destinatario;
- origen asociado a mención/comentario;
- contexto para navegar al elemento relacionado.

Leído/no leído, fechas y otros campos quedan pendientes de Spec.

## Evento de Auditoría

| Campo      | Definición                               |
| ---------- | ---------------------------------------- |
| Entidad    | Tipo afectado.                           |
| EntityId   | Registro afectado.                       |
| Acción     | Create / Modify / Soft delete / Restore. |
| Usuario    | Autor.                                   |
| Fecha/hora | Momento.                                 |
| Cambios    | Campo, valor anterior y nuevo.           |
| Motivo     | Opcional u obligatorio según regla.      |
| Contexto   | Opcional.                                |

Retención indefinida. No es event sourcing. La auditoría automática no sustituye motivos de negocio obligatorios.

## Motivo de Replanificación

Valores candidatos:

- Nueva prioridad / urgencia
- Bloqueo / dependencia
- Esperando cliente / tercero
- Cambio de capacidad / disponibilidad
- Trabajo subestimado
- Cambio solicitado por cliente
- Otro

Puede acompañarse de nota opcional. Está pendiente decidir si será catálogo/entidad o valor controlado del evento de cambio.

## Configuración Global

Parámetros definidos:

- inicio de semana;
- zona horaria global de compañía;
- horario corporativo.

Catálogos configurables por Administrador:

- Categorías de Actividad;
- Tipos de Ausencia;
- Tipos de Bloque de Agenda sin Actividad.

Catálogos fijos en MVP:

- Estados de Actividad;
- Estados de Proyecto;
- Estados de Requerimiento;
- Prioridades;
- Roles.

## Campos técnicos transversales

En entidades principales se definieron conceptualmente:

| Campo     | Definición                         |
| --------- | ---------------------------------- |
| createdAt | Fecha/hora de creación.            |
| createdBy | Usuario creador.                   |
| updatedAt | Fecha/hora de última modificación. |
| updatedBy | Usuario de última modificación.    |

Además:

- borrado lógico donde aplique;
- restauración solo por Administrador;
- concurrencia optimista en registros modificables relevantes.

Los nombres físicos, tipos SQL, claves, campo de versión y mecanismo exacto de soft delete no están definidos.

## Relaciones principales

```text
Cliente
├── Proyecto
│   └── Etapa
│       └── Actividad
├── Requerimiento
│   └── Actividad
└── Ticket
    └── Actividad

Actividad
├── Actividad padre (opcional)
├── Dependencias → Actividades
├── Bloques de Agenda
├── Registros de Tiempo
└── Comentarios

Persona
├── Identidad
├── Rol
├── Horario personal
├── Ausencias
├── Bloques de Agenda
├── Registros de Tiempo
├── Comentarios
├── Menciones
└── Notificaciones
```

## Pendientes de modelado detallado

1. Modelo completo de Persona/Usuario y vínculo exacto con Entra ID.
2. Modelo físico de Horario Corporativo y Personal.
3. Campos administrativos de catálogos configurables.
4. Modelo completo de Notificación.
5. Asociación genérica de Comentarios.
6. Representación física de Actividad + Semana.
7. Representación exacta del historial de Agenda sobre auditoría.
8. Ausencias parciales en primer/último día.
9. Festivos/días no laborables.
10. Clasificación exacta de bloques sin Actividad.
11. Semántica de quién registró/aprobó un Requerimiento.
12. Tipos, longitudes, nulabilidad, índices y restricciones físicas de base de datos.

Estos puntos deben resolverse en sus Specs y no asumirse silenciosamente durante implementación.
