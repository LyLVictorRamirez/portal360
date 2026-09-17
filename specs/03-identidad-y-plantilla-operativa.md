# SPEC 03 — Identidad y plantilla operativa

> **Status:** Aprobada
> **Depends on:** SPEC 02
> **Date:** 2026-09-16
> **Objective:** Definir una identidad visual clara y una plantilla operativa reutilizable para `apps/web` que prepare Portal 360 para el trabajo diario sin añadir módulos de negocio.

## Por qué existe esta spec

La plantilla neutra de SPEC 02 validó la estructura de navegación, pero aún no comunica el carácter operativo de Portal 360.

La nueva base debe ayudar a consultar prioridades y compromisos con rapidez.

## Scope

**In:**

- Evolucionar los tokens semánticos de `apps/web/src/app/globals.css` hacia la identidad visual **Brújula operativa**.
- Mantener exclusivamente el modo claro y fijar la paleta Niebla `#F1F4F4`, Papel `#FFFFFF`, Tinta `#162A31`, Canal `#006B71`, Ocre `#C88719` y Alerta `#B33E43`.
- Incorporar IBM Plex Sans mediante la integración de fuentes de Next.js, con alternativas del sistema como respaldo.
- Crear una marca reutilizable de Portal 360 compuesta por un símbolo circular de tres segmentos y el nombre del producto.
- Reestructurar Sidebar, Top Bar, Application Shell y Page Header para separar la identidad, el contexto de página y las acciones.
- Crear componentes base propios para botones, campos, selectores, áreas de texto, badges de estado, superficies, filas de trabajo, tablas, diálogos y menús.
- Rediseñar los estados de carga, vacío, error, no autorizado y no encontrado con el nuevo sistema visual.
- Mantener la preferencia `portal-360:sidebar-collapsed` y mejorar la operación accesible del panel lateral móvil.
- Convertir `/` en una muestra estática de “Foco de trabajo” que demuestre jerarquía, filtros, filas, estados, tabla y acciones sin consumir ni persistir datos.
- Rediseñar `/login` con la nueva identidad y una acción informativa sin formulario ni autenticación.
- Cumplir WCAG 2.2 AA para contraste, foco visible, controles etiquetados, operación por teclado y respeto de `prefers-reduced-motion`.

**Out of scope (for future specs):**

- Backend, APIs, persistencia, datos reales, autenticación, sesiones, Microsoft Entra ID, usuarios, permisos o perfiles.
- Módulos funcionales de Clientes, Proyectos, Requerimientos, Tickets, Actividades, Agenda, capacidad, tiempos o auditoría.
- KPIs, gráficos, dashboard ejecutivo o cálculo real de prioridades.
- Modo oscuro, selector de tema, temas alternativos o personalización visual por usuario.
- Una librería de componentes de terceros, activos fotográficos, ilustraciones decorativas o una guía de marca corporativa externa.
- Pruebas visuales automatizadas, Storybook o un sitio separado de documentación de componentes.

## Modelo de configuración

Esta spec no introduce modelos de dominio ni persistencia nueva.

Se conserva exclusivamente la preferencia local existente:

```text
localStorage key: portal-360:sidebar-collapsed
value: "true" | "false"
```

Los tokens del tema claro se centralizarán en `apps/web/src/app/globals.css`.

```text
--canvas: #F1F4F4          # Niebla, fondo de la aplicación
--surface: #FFFFFF         # Papel, superficies de trabajo
--foreground: #162A31      # Tinta, texto y navegación
--primary: #006B71         # Canal, acción y foco
--warning: #C88719         # Ocre, atención y prioridad
--danger: #B33E43          # Alerta, errores y bloqueos
```

Los tokens también cubrirán texto secundario, superficie elevada, bordes, selección, foco, estado positivo, radios, sombras, espaciado, escala tipográfica y movimiento.

La densidad base será compacta y respirable: controles de al menos 40 px, filas operativas de 44 px y separación de 24 a 32 px entre secciones independientes.

Las filas y la tabla de Inicio usarán contenido de muestra declarado localmente en la página.

Ese contenido no representa Actividades, Personas ni compromisos reales.

## Plan de implementación

1. Actualizar `apps/web/src/app/layout.tsx` para cargar IBM Plex Sans y ampliar `apps/web/src/app/globals.css` con los tokens Brújula operativa, el tema claro, la escala tipográfica, densidad, foco y la reducción de movimiento; comprobar contraste de los pares de texto y superficie.
2. Crear `apps/web/src/components/ui/portal-360-mark.tsx` con la marca circular de tres segmentos y su versión con nombre; comprobar que puede anunciar “Portal 360” sin depender de iconos de Lucide.
3. Crear `apps/web/src/components/ui/button.tsx` y adaptar `apps/web/src/components/ui/icon-button.tsx` a las variantes, estados de foco, deshabilitado y tamaños definidos; comprobar su uso sin estilos duplicados.
4. Crear `apps/web/src/components/ui/surface.tsx` y `apps/web/src/components/ui/status-badge.tsx`; comprobar que las superficies no se convierten en una cuadrícula uniforme de tarjetas y que cada estado se distingue sin depender solo del color.
5. Crear `apps/web/src/components/ui/field-label.tsx` y `apps/web/src/components/ui/text-field.tsx` con etiqueta visible, ayuda opcional, estado de error y foco accesible; comprobar su navegación con Tab.
6. Crear `apps/web/src/components/ui/select-field.tsx` y `apps/web/src/components/ui/textarea-field.tsx` con la misma semántica de etiqueta, ayuda, error y estados deshabilitados; comprobar que conservan la fuente y el contraste del sistema.
7. Crear `apps/web/src/components/ui/work-list.tsx` para representar filas densas con contexto, estado, prioridad y responsable de muestra; comprobar que la información conserva orden de lectura en móvil.
8. Crear `apps/web/src/components/ui/data-table.tsx` con encabezados semánticos, celdas alineadas y contenedor de desbordamiento horizontal en pantallas pequeñas; comprobar que sigue siendo legible a 375 px.
9. Crear `apps/web/src/components/ui/dialog.tsx` con apertura, cierre, Escape, foco contenido y restauración de foco; comprobar el comportamiento con teclado y lector de pantalla.
10. Crear `apps/web/src/components/ui/menu.tsx` con activador, elementos operables por teclado y cierre explícito; comprobar que no expone acciones de cuenta o sesión inexistentes.
11. Reestructurar `apps/web/src/components/layout/application-shell.tsx` y `apps/web/src/components/layout/app-sidebar.tsx` para usar la marca, conservar la preferencia de colapsado, indicar solo la ruta activa y contener el foco del panel móvil; comprobar escritorio expandido, escritorio colapsado y móvil.
12. Actualizar `apps/web/src/components/layout/top-bar.tsx` y `apps/web/src/components/ui/page-header.tsx` para mostrar contexto de página en vez de repetir la marca y para usar las nuevas acciones; comprobar que la barra superior no contiene controles aparentes sin respuesta.
13. Actualizar `apps/web/src/components/states/interface-states.tsx` y `apps/web/src/app/not-found.tsx` para aplicar la nueva jerarquía, iconografía Lucide y reducción de movimiento; comprobar una URL inexistente.
14. Rediseñar `apps/web/src/app/(app)/page.tsx` como Inicio con “Foco de trabajo”, filtros visuales, filas y tabla de muestra, sin métricas ni datos reales; comprobar que todos los patrones usan los componentes base.
15. Rediseñar `apps/web/src/app/(public)/login/page.tsx` con la marca, la tipografía y una acción informativa que no simule autenticación; comprobar que sigue fuera del Application Shell y no contiene campos ni envío.

## Criterios de aceptación

- [ ] `apps/web/src/app/globals.css` centraliza los tokens Brújula operativa y conserva `color-scheme: light`.
- [ ] La interfaz usa Niebla, Papel, Tinta, Canal, Ocre y Alerta mediante tokens semánticos, no mediante valores visuales dispersos en componentes.
- [ ] IBM Plex Sans se aplica al contenido de la aplicación y existe una cadena de fuentes de respaldo.
- [ ] La marca circular y el nombre “Portal 360” se muestran en Sidebar y Login.
- [ ] La Top Bar muestra el contexto de la página y no repite la identidad como contenido principal.
- [ ] Existen componentes reutilizables de botón, icono, campo, selector, área de texto, badge, superficie, fila de trabajo, tabla, diálogo y menú.
- [ ] Los controles muestran etiqueta visible o nombre accesible, estado de foco y estado deshabilitado cuando corresponda.
- [ ] Los badges y estados comunican su significado mediante texto o iconografía además del color.
- [ ] La tabla conserva encabezados semánticos y se puede consultar sin pérdida de contenido a 375 px.
- [ ] Los diálogos y menús se pueden abrir, recorrer y cerrar solo con teclado.
- [ ] Al cerrar un diálogo o el panel lateral móvil, el foco vuelve al control que lo abrió.
- [ ] El Sidebar conserva su preferencia de colapsado tras recargar y solo la ruta actual declara `aria-current="page"`.
- [ ] El panel lateral móvil se abre desde la Top Bar, se cierra con Escape y no deja el foco disponible en contenido de fondo.
- [ ] La interfaz desactiva o reduce transiciones y el spinner cuando el sistema solicita reducir movimiento.
- [ ] Los pares de texto, icono y fondo que comunican información cumplen contraste WCAG 2.2 AA.
- [ ] `/` presenta una muestra estática de Foco de trabajo sin KPI, gráfico, llamada a API, persistencia ni afirmación de datos reales.
- [ ] `/login` presenta la identidad Brújula operativa sin formulario, sesión, proveedor de acceso ni envío de credenciales.
- [ ] Los estados de carga, vacío, error, no autorizado y no encontrado usan el nuevo sistema visual.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** identidad Brújula operativa; traduce el ciclo de planear, ejecutar y revisar a una marca sobria para una herramienta interna.
- **Sí:** símbolo circular de tres segmentos junto al nombre Portal 360; genera reconocimiento sin incorporar activos decorativos ajenos al producto.
- **Sí:** IBM Plex Sans; aporta una voz técnica y legible para trabajo operativo sin añadir una librería visual.
- **Sí:** paleta clara de Niebla, Papel, Tinta, Canal, Ocre y Alerta; prioriza lectura prolongada, prioridad y contraste.
- **Sí:** densidad compacta y respirable; facilita revisar trabajo frecuente sin sacrificar el espacio necesario para leer contexto.
- **Sí:** filas, superficies y tablas como estructura dominante; representan mejor trabajo operativo que una cuadrícula de tarjetas idénticas.
- **Sí:** componentes propios mínimos sobre Tailwind CSS y Lucide React; conserva control visual y evita introducir dependencias de UI antes de necesitar composiciones más complejas.
- **Sí:** Inicio estático como muestra de Foco de trabajo; permite validar la plantilla sin inventar un módulo de negocio ni datos reales.
- **Sí:** diálogos, menús y panel móvil accesibles por teclado; los patrones de interacción deben ser correctos antes de reutilizarlos.
- **No:** dashboard con KPIs, gráficos o widgets; no aporta valor hasta que exista una fuente de datos y una necesidad operativa definida.
- **No:** modo oscuro; se aplaza hasta que haya una decisión de producto o una guía de marca que lo justifique.
- **No:** autenticación simulada; Login y menú de usuario comunicarán que el acceso aún no está configurado.
- **No:** una cuadrícula de tarjetas con sombras como patrón general; volvería genérica una interfaz que debe facilitar priorización y lectura rápida.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La fuente remota no está disponible durante el build. | Usar la integración de fuente de Next.js con respaldo del sistema y validar el build de producción antes de aceptar el cambio. |
| El contenido de muestra se interpreta como trabajo real. | Etiquetarlo explícitamente como muestra de plantilla y no mostrar cifras, fechas comprometidas ni nombres de personas reales. |
| El nuevo diálogo o panel móvil deja escapar el foco. | Probar apertura, Tab, Shift+Tab, Escape y restauración de foco en escritorio y móvil. |
| Los tokens se degradan con clases de color locales. | Revisar que componentes y rutas consumen tokens semánticos y prohibir valores de paleta directos fuera de `globals.css`. |
| Una base de componentes crece antes de haber casos de uso reales. | Limitar esta spec a los patrones aprobados y dejar componentes especializados para sus specs funcionales. |

## Qué **no** está en esta spec

- Datos, lógica, API, persistencia o módulos de negocio.
- Autenticación, perfiles, sesiones, permisos o Microsoft Entra ID.
- Dashboard ejecutivo, indicadores, gráficos o analítica.
- Modo oscuro, temas alternativos o una guía de marca externa.
- Librería UI de terceros, Storybook, pruebas visuales automatizadas o assets decorativos.
