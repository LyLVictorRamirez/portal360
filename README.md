# LyL Control

LyL Control es una aplicación web interna para coordinar el trabajo de un equipo de consultoría y desarrollo que atiende proyectos de implementación, requerimientos de clientes y tickets escalados.

Su objetivo es dar claridad sobre **qué debe trabajar cada persona, qué es prioritario, qué compromisos existen, qué capacidad está disponible y qué ocurrió realmente durante la semana**.

## Objetivos

- Centralizar el trabajo relevante sin reemplazar herramientas externas especializadas.
- Organizar el trabajo por cliente y contexto.
- Planificar agenda y capacidad.
- Distinguir trabajo semanal obligatorio y opcional.
- Controlar prioridades, bloqueos, dependencias y compromisos.
- Registrar esfuerzo real.
- Conservar trazabilidad de cambios y replanificaciones.
- Facilitar el control semanal y detectar desviaciones en proyectos.

No pretende convertirse en ERP, CRM, PSA, sistema de RR. HH. ni gestor de proyectos completo.

## Usuarios y roles

La aplicación es exclusivamente interna y será utilizada por consultores, desarrolladores, líderes de proyecto y coordinadores.

- **Administrador:** acceso completo y configuración global.
- **Líder/Coordinador:** gestión operativa del equipo, planificación y contenedores de trabajo.
- **Miembro del equipo:** acceso al trabajo del equipo, gestión de su agenda y gestión completa de las Actividades de las que es responsable.

## Modelo de trabajo

Todo trabajo sigue:

**Cliente → Contenedor de trabajo → Actividad**

Los contenedores son **Proyecto**, **Requerimiento** y **Ticket**.

Los Proyectos pueden añadir una Etapa:

**Cliente → Proyecto → Etapa → Actividad**

El trabajo interno utiliza la misma estructura mediante un cliente interno.

### Actividades

La Actividad es la unidad principal de ejecución. Puede incluir responsable, estado, prioridad, categoría, estimación, fechas, indicador de entregable, dependencias y orden.

Puede existir una relación padre/hija con máximo dos niveles.

Estados del MVP: **Pendiente, En progreso, En revisión, Pruebas cliente, Bloqueada, Esperando tercero y Finalizada**.

Las dependencias se expresan mediante **“Depende de”**. Una Actividad puede trabajarse con dependencias pendientes, pero normalmente no puede finalizarse hasta que estas estén finalizadas.

## Planificación y Agenda

El flujo operativo principal es:

**Actividad → Agenda planificada → Ejecución → Registro de tiempo**

La Agenda reserva tiempo de una Persona mediante bloques con fecha y hora. Un bloque puede representar trabajo asociado a una Actividad u otra ocupación que afecte disponibilidad.

La disponibilidad se deriva del horario corporativo, ajustes personales y ausencias o indisponibilidades.

La planificación puede generar **sobrecapacidad, solapamiento o trabajo fuera de horario**. Estos casos producen advertencias, no bloqueos.

### Planificación semanal

El trabajo planificado de una Actividad para una semana puede ser:

- **Obligatorio:** debe recibir la atención planificada esa semana.
- **Opcional:** puede desplazarse cuando cambian prioridades o capacidad.

La semana no se publica ni congela manualmente. El sistema conserva historial para comparar:

**Plan al inicio → Cambios → Plan final → Ejecución real**

Los cambios materialmente relevantes sobre trabajo obligatorio requieren justificación.

## Registro de tiempo

El tiempo trabajado se registra contra una Actividad e incluye Persona, fecha, horas reales, nota opcional y bloque de Agenda de origen cuando exista.

Puede registrarse desde Agenda o directamente desde Actividad. Registrar tiempo no cambia automáticamente el estado de la Actividad.

## Contenedores de trabajo

### Proyectos
Estructuran implementaciones mediante Etapas y Actividades. Su control utiliza señales objetivas como Actividades vencidas, bloqueadas, entregables próximos, estimado frente a real y fecha final comprometida.

### Requerimientos
Representan solicitudes de clientes y siguen:

**Nuevo → En análisis → Cotizado → Aprobado → En ejecución → Cerrado**

`Cancelado` es una salida alternativa.

### Tickets
Representan trabajo originado en una plataforma externa. LyL Control conserva la referencia necesaria para gestionar el trabajo interno, mientras la plataforma externa sigue siendo la fuente de verdad de su workflow y estado.

En el MVP la referencia es manual; la integración automática queda para una fase posterior.

## Colaboración

La colaboración utiliza comentarios y menciones dentro del contexto del trabajo. Las menciones generan notificaciones internas.

El MVP no incluye chat, conversaciones anidadas, reacciones ni mensajería en tiempo real.

## Trazabilidad

Las entidades principales mantienen auditoría para conocer **qué cambió, quién lo cambió, cuándo y cuáles fueron los valores anterior y nuevo**. Cuando una regla de negocio lo exige, también se conserva el motivo.

Se utiliza borrado lógico. La restauración está reservada al Administrador y la auditoría tiene retención indefinida.

## Arquitectura

- **Frontend:** Next.js + TypeScript
- **Backend:** NestJS + TypeScript
- **Base de datos:** PostgreSQL
- **ORM:** TypeORM
- **Autenticación:** Microsoft Entra ID
- **Arquitectura backend:** monolito modular
- **Despliegue:** frontend y backend separados

Se aplican **KISS** y **YAGNI**. No se introducirán microservicios, CQRS, event sourcing, múltiples bases de datos, colas u otra complejidad sin una necesidad demostrada.

### Decisiones transversales

- Una zona horaria global de compañía.
- Concurrencia optimista.
- Auditoría transversal y borrado lógico.
- Backup diario y capacidad de restauración.
- Logs estructurados y errores centralizados.
- Secretos mediante entorno o plataforma de despliegue.
- Ambientes Development y Production.
- Producción automatizada con aprobación explícita.
- Hosting pendiente de definición.

## MVP

Incluye clientes, proyectos y etapas, requerimientos, tickets, actividades y dependencias, agenda, capacidad y disponibilidad, planificación semanal, registro de tiempo, comentarios y menciones, autenticación, usuarios, roles y permisos, auditoría, control semanal y control básico de proyectos.

Quedan fuera inicialmente: adjuntos, integración automática de tickets, CRM/contactos, plantillas de proyectos, scoring automático de riesgos, planificación automática, analítica predictiva, dashboards ejecutivos complejos, gestión financiera, workflows de RR. HH., chat en tiempo real y jerarquías ilimitadas.

## Specs

El desarrollo se organiza mediante **Specs funcionales end-to-end**. Una Spec describe una capacidad completa y puede abarcar datos, backend, API, frontend, permisos, auditoría y criterios de aceptación. No se divide artificialmente entre frontend y backend.

Cada Spec debe tener un objetivo claro en una frase, alcance y exclusiones, reglas de negocio, datos/UX/API cuando apliquen, plan de implementación, criterios de aceptación verificables, decisiones y preguntas abiertas.

Una Spec permanece en **Draft** hasta aprobación explícita y solo puede considerarse **READY FOR DEVELOPMENT** cuando no existen preguntas críticas abiertas.

## Principios

- Claridad operativa sobre sofisticación.
- No duplicar capacidades que otras herramientas ya resuelven.
- Una fuente de verdad por concepto.
- Derivar automáticamente información que no necesita captura manual.
- Trazabilidad sin convertir el sistema en vigilancia individual.
- Soluciones simples, mantenibles y verificables.
- Añadir complejidad solo cuando una necesidad real la justifique.
