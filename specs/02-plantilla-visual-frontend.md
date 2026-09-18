# SPEC 02 — Plantilla visual del frontend

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-09-14
> **Objective:** Crear una plantilla visual neutra y reutilizable para `apps/web` con un Application Shell, Login público, navegación responsive y estados de interfaz base.

## Por qué existe esta spec

Portal 360 necesita un marco de interfaz coherente antes de descubrir e implementar los módulos de negocio.

## Scope

**In:**

- Incorporar Tailwind CSS en `apps/web` para composición, espaciado, responsive y estilos utilitarios.
- Definir tokens visuales neutros como variables CSS en `apps/web/src/app/globals.css`.
- Añadir Lucide React como librería estándar de iconos de la aplicación.
- Crear un Application Shell reutilizable con Sidebar, Top Bar y área de contenido principal.
- Hacer el Sidebar persistente y colapsable en desktop.
- Guardar la preferencia local del Sidebar en `localStorage`.
- Adaptar el Sidebar a un panel lateral temporal en móvil, abierto desde la Top Bar.
- Mostrar únicamente la opción funcional `Inicio` en la navegación inicial.
- Crear un encabezado de página reutilizable con título, descripción opcional y acción principal opcional.
- Crear la página raíz `/` dentro del Application Shell como vista inicial neutra.
- Crear la pantalla pública `/login` fuera del Application Shell con una acción visual de inicio de sesión.
- Crear componentes reutilizables para los estados de carga, vacío, error, no autorizado y no encontrado.
- Conectar el estado no encontrado al mecanismo `not-found` de Next.js.

**Out of scope (for future specs):**

- Cambios en `apps/api`, nuevas APIs o integración con backend.
- Autenticación real o simulada, sesiones, protección de rutas, roles y permisos.
- Decidir el proveedor o mecanismo futuro de autenticación.
- Formularios de correo y contraseña, recuperación de acceso, registro, recordatorio de sesión o validaciones de Login.
- Módulos de negocio, enlaces de navegación para ellos, dashboards con KPIs, widgets, tablas o formularios funcionales.
- Guía de marca definitiva, logotipo definitivo, tipografía corporativa, modo oscuro o temas alternativos.
- Librería completa de dashboard o sistema de componentes de terceros más allá de Tailwind CSS y Lucide React.

## Modelo de configuración

Esta spec no introduce modelos de dominio ni persistencia de negocio.

La única persistencia local de interfaz será la preferencia de colapsado del Sidebar:

```text
localStorage key: portal-360:sidebar-collapsed
value: "true" | "false"
```

Los tokens visuales vivirán en `apps/web/src/app/globals.css` como variables CSS semánticas para fondo, texto, superficies, bordes, radios y estados.

Los componentes usarán esos tokens mediante utilidades de Tailwind o variables CSS, sin dispersar valores visuales definitivos en el código.

## Plan de implementación

1. Actualizar `apps/web/package.json` e incorporar la configuración mínima de Tailwind CSS compatible con la versión vigente de Next.js; comprobar que una clase utilitaria se procesa en la página existente.
2. Reorganizar `apps/web/src/app` mediante grupos de ruta para separar el layout de la aplicación y el layout público; conservar `/` para Inicio y crear `/login` como ruta pública sin Application Shell.
3. Sustituir la base de `apps/web/src/app/globals.css` por tokens CSS neutros, reset mínimo y estilos globales que permitan tematización posterior; comprobar contraste y legibilidad en las dos rutas iniciales.
4. Añadir Lucide React y crear los componentes visuales mínimos reutilizables en `apps/web/src/components`, incluyendo botones de icono, `PageHeader` y la base de los estados de interfaz; comprobar que no se usan emojis, caracteres Unicode ni iconos propios como sustitutos.
5. Crear `ApplicationShell`, `AppSidebar` y `TopBar` en `apps/web/src/components`; incluir `Inicio` como único ítem funcional, el espacio de identidad y el menú de usuario; comprobar la visualización persistente en desktop.
6. Implementar el Sidebar colapsable con la clave `portal-360:sidebar-collapsed`; restaurar la preferencia tras recargar sin bloquear el renderizado inicial de Next.js.
7. Implementar el comportamiento móvil del shell: Sidebar oculto por defecto, botón de navegación en la Top Bar, panel temporal y cierre al seleccionar Inicio; comprobar que el contenido conserva el ancho útil de pantalla.
8. Crear la página de Inicio neutra usando `PageHeader` y el Application Shell; comprobar que ilustra el patrón de navegación sin incluir KPIs, widgets ni módulos de negocio.
9. Crear la pantalla `/login` con la identidad de Portal 360, título, texto breve y acción visual `Iniciar sesión`; comprobar que no contiene campos, envío, validaciones ni lógica de autenticación.
10. Crear `LoadingState`, `EmptyState`, `ErrorState`, `UnauthorizedState` y `NotFoundState`; conectar `apps/web/src/app/not-found.tsx` a `NotFoundState` y comprobar una URL inexistente.

## Criterios de aceptación

- [x] `apps/web` usa Tailwind CSS y conserva tokens globales semánticos definidos en `apps/web/src/app/globals.css`.
- [x] Lucide React es la única fuente de iconos para navegación, acciones y estados de la plantilla.
- [x] La ruta `/` muestra Inicio dentro de un Application Shell con Sidebar, Top Bar y contenido principal.
- [x] La ruta `/login` se renderiza fuera del Application Shell.
- [x] El Sidebar desktop puede alternar entre expandido y colapsado, y su preferencia se conserva tras una recarga.
- [x] En pantallas pequeñas, el Sidebar está oculto inicialmente y se abre como panel temporal desde la Top Bar.
- [x] El panel lateral móvil se cierra al seleccionar Inicio y no ocupa espacio horizontal persistente.
- [x] La navegación inicial solo contiene Inicio como opción funcional y el menú de usuario en su ubicación visual.
- [x] El encabezado de página reutilizable admite título, descripción opcional y acción principal opcional.
- [x] La página inicial es neutra y no contiene KPIs, widgets, tablas, formularios ni módulos de negocio.
- [x] `/login` muestra identidad, título, texto explicativo y la acción visual `Iniciar sesión` sin campos ni comportamiento de autenticación.
- [x] Existen componentes reutilizables para carga, vacío, error, no autorizado y no encontrado.
- [x] Una URL inexistente renderiza el estado no encontrado mediante el mecanismo estándar de Next.js.
- [x] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` terminan correctamente desde la raíz.

## Decisiones

- **Sí:** Application Shell con Sidebar, Top Bar y área principal; establece un patrón único para las futuras páginas privadas.
- **Sí:** grupos de rutas internos de Next.js; separan los layouts público y de aplicación sin cambiar las URLs `/` y `/login`.
- **Sí:** Tailwind CSS junto con tokens CSS semánticos; combina velocidad de composición y una futura tematización controlada.
- **No:** una identidad de marca definitiva en esta etapa; se usa una base corporativa neutra para no bloquear decisiones de marca posteriores.
- **Sí:** Lucide React como fuente estándar de iconos; mantiene consistencia y evita iconografía improvisada.
- **Sí:** Sidebar persistente y colapsable en desktop; optimiza el espacio de trabajo para uso frecuente.
- **Sí:** `localStorage` para la preferencia del Sidebar; es una preferencia local no sensible que no requiere backend ni sesión.
- **Sí:** Sidebar móvil temporal; conserva navegación usable sin reducir permanentemente el área de contenido.
- **Sí:** Inicio como único enlace inicial; demuestra el patrón de navegación sin anticipar el mapa funcional.
- **Sí:** Login extendible con una única acción visual; prepara la interfaz sin elegir un proveedor o flujo de autenticación.
- **No:** dashboard, módulos de negocio o páginas demostrativas temporales para los estados; se aplazan hasta el descubrimiento funcional.
- **Sí:** componentes de estado reutilizables y solo `not-found` conectado como ruta especial; evita crear rutas sin valor de producto.
- **No:** modo oscuro; se definirá cuando exista una guía de marca o una necesidad funcional aprobada.

## Riesgos

| Riesgo                                                   | Mitigación                                                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Parpadeo visual al restaurar la preferencia del Sidebar  | Leer y aplicar la preferencia exclusivamente en un componente cliente con un estado inicial controlado.     |
| Inaccesibilidad del panel móvil                          | Incluir etiquetas accesibles, foco operable y cierre explícito desde el control de navegación.              |
| Valores visuales dispersos al crear componentes          | Usar tokens semánticos de `globals.css` como única fuente de colores, bordes, radios y superficies.         |
| La plantilla se convierta prematuramente en un dashboard | Limitar la navegación a Inicio y excluir KPIs, widgets y módulos de negocio de los criterios de aceptación. |

## Qué **no** está en esta spec

- Backend, API, base de datos o modificaciones en `apps/api`.
- Autenticación, autorización, sesiones, roles, permisos o proveedor de acceso.
- Módulos de negocio y su mapa de navegación.
- Dashboard con indicadores, widgets, tablas o formularios.
- Identidad de marca final, modo oscuro o temas alternativos.
