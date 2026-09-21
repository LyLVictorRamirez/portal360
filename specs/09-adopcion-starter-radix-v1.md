# SPEC 09 — Adopción visual completa del starter Radix v1

> **Status:** Aprobada
> **Depends on:** SPEC 02, SPEC 03, SPEC 04, SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-09-20
> **Objective:** Adoptar el diseño, catálogo UI y shell de `next-shadcn-dashboard-starter` v1.0.0 sin alterar la identidad, autenticación, autorización ni datos de Portal 360.

## Por qué existe esta spec

Portal 360 ya dispone de rutas y flujos operativos autorizados, pero su capa visual no usa un
sistema de navegación, temas y componentes tan completo como el starter seleccionado.

El tag `v1.0.0` es la fuente visual aprobada porque usa Radix UI, el estilo New York, base Zinc,
iconografía Radix y diez variantes de tema. Esta decisión excluye Base UI y las integraciones Clerk
de las versiones posteriores del starter.

## Alcance

**Incluye:**

- Reemplazar el clon temporal `reference-starter` por el tag `v1.0.0` de
  `Kiranism/next-shadcn-dashboard-starter`, verificando que no contiene cambios locales antes de
  reemplazarlo.
- Incorporar el catálogo completo de componentes UI v1, temas, fuentes, iconos, providers y
  componentes de layout en `apps/web`.
- Normalizar los imports de primitivas del starter hacia `radix-ui@^1.6.7`, sin instalar paquetes
  individuales `@radix-ui/react-*`.
- Aplicar el estilo New York/Zinc, los diez temas del starter y sus fuentes originales.
- Integrar tema claro/oscuro, selector de paleta, KBar, Nuqs, React Query, Sonner y cargador
  superior sin cambiar los contratos de negocio existentes.
- Reconstruir sidebar, rail, header, breadcrumbs, infobar, selector fijo de Portal 360 y menú de
  cuenta con el diseño del starter.
- Adaptar todas las integraciones Clerk del starter a Better Auth y a los permisos RBAC actuales.
- Migrar las tablas, encabezados, formularios, filtros, superficies y estados de las pantallas
  existentes a los componentes v1, incluidas las seis tablas actuales a TanStack Table.
- Reemplazar los iconos de interfaz restantes por Radix Icons o Tabler Icons antes de retirar
  `lucide-react`.

**Fuera de alcance:**

- Cambios en el modelo de datos, migraciones, endpoints, contratos HTTP o reglas RBAC.
- Organizaciones, multitenancy, perfil, facturación, área de trabajo o notificaciones reales.
- Contenido de demostración, usuarios de prueba, datos ficticios o enlaces al repositorio del
  starter.
- Una migración a Base UI, Clerk, otra versión del starter o una actualización de Next, React,
  Tailwind o Better Auth fuera de la necesaria para sus dependencias.

## Modelo de datos y persistencia

Esta spec no introduce entidades ni cambia datos persistidos de negocio.

La identidad sigue perteneciendo a Better Auth y los permisos siguen perteneciendo al esquema
`authorization` de Portal 360.

La interfaz añadirá únicamente estas preferencias de presentación:

| Preferencia         | Persistencia                             | Valor inicial | Regla                                                           |
| ------------------- | ---------------------------------------- | ------------- | --------------------------------------------------------------- |
| modo claro u oscuro | `localStorage`, clave `portal-360:theme` | sistema       | La elección explícita de la persona prevalece sobre el sistema. |
| paleta activa       | cookie `active_theme`                    | `vercel`      | El servidor puede leerla antes de pintar para evitar parpadeo.  |
| estado del sidebar  | cookie del sidebar v1                    | abierto       | Se conserva entre recargas sin afectar permisos ni navegación.  |

El shell recibirá una forma interna equivalente a:

```ts
type ShellUser = {
  name: string | null;
  email: string;
  image: string | null;
};
```

Los permisos continuarán llegando desde el layout servidor y nunca se derivarán de la sesión de
cliente.

## Plan de implementación

1. Verificar el tag v1, recrear el clon temporal aislado y actualizar el manifiesto y lockfile con
   las dependencias de UI que tengan imports reales; comprobar que la aplicación todavía compila sin
   Clerk, Base UI ni paquetes individuales de Radix.
2. Migrar el catálogo `components/ui`, iconos, utilidades y estilos v1; conservar el runtime
   `radix-ui` actual, actualizar `components.json` a New York/Zinc/Radix y comprobar que cada
   componente se resuelve en TypeScript.
3. Integrar las fuentes, diez paletas, modo de color, providers, KBar, Nuqs, Query Provider, Sonner
   y cargador superior en el root layout; comprobar que el primer render respeta modo, paleta y
   preferencias sin error de hidratación.
4. Sustituir el shell actual por el sidebar, rail, header, breadcrumbs, avatar, selector de paleta,
   infobar y utilidades v1; adaptar la sesión a `authClient.useSession()`, mantener cierre de sesión
   Better Auth y filtrar rutas por los permisos ya calculados en servidor.
5. Portar cada pantalla de Portal 360 a PageContainer, Heading, TanStack Table y formularios/campos
   v1; comprobar que listados, filtros, validaciones, mutaciones, errores y restricciones de cada
   ruta preservan su comportamiento funcional.
6. Retirar adaptadores e iconos obsoletos tras migrar sus consumidores; ejecutar pruebas focalizadas
   y la validación completa del monorepo, y capturar evidencia visual de los temas y estados del
   shell.

## Criterios de aceptación

- [ ] `reference-starter` está en el tag `v1.0.0` y no se copian componentes de `main` ni v2.
- [ ] `apps/web` no contiene imports de Clerk ni Base UI.
- [ ] Todos los componentes del catálogo UI v1 compilan usando el paquete único `radix-ui`.
- [ ] El modo inicia con la preferencia del sistema y conserva una elección manual en
      `portal-360:theme`.
- [ ] Las diez paletas, incluida `vercel` por defecto, se aplican sin flash visual y conservan sus
      fuentes originales.
- [ ] El sidebar, header, breadcrumbs, paleta de comandos, infobar, avatar y selector fijo de Portal
      360 funcionan en escritorio, móvil y estado colapsado.
- [ ] La paleta de comandos solo presenta rutas existentes que la persona actual puede abrir.
- [ ] Las notificaciones e infobar muestran estados vacíos neutrales y no contienen datos ficticios.
- [ ] La cuenta muestra foto o iniciales, nombre, email y permite cerrar sesión mediante Better Auth.
- [ ] Las rutas actuales mantienen sus permisos y sus operaciones de listado, filtros, formularios y
      mutaciones después de adoptar TanStack Table y los componentes v1.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y
      `corepack pnpm format:check` finalizan con código `0` desde la raíz.

## Decisiones

- **Sí:** starter `v1.0.0`; es la revisión exacta aprobada y usa Radix UI.
- **No:** Base UI; no es necesario cambiar el runtime de primitivas del proyecto.
- **Sí:** normalizar las fuentes individuales Radix del starter al paquete `radix-ui` existente;
  evita dos runtimes de primitivas con resultado visual equivalente.
- **Sí:** diez paletas y tipografías originales del starter; la fidelidad visual incluye ambos.
- **Sí:** Portal 360 como identidad fija del selector de organización; conserva el patrón visual sin
  inventar un modelo de tenancy.
- **Sí:** `authClient.useSession()` para el menú de cliente y permisos provenientes del servidor;
  separa identidad de Better Auth y autorización RBAC.
- **Sí:** migración directa de las pantallas a TanStack Table y componentes v1; evita mantener dos
  APIs visuales incompatibles.
- **No:** CTA al GitHub del starter, menús de perfil/facturación y notificaciones funcionales; no
  existen en el producto actual.

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                             |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| APIs v1 escritas para Radix individual difieren del paquete consolidado actual. | Compilar y probar cada componente tras normalizar imports, sin degradar `radix-ui@^1.6.7`.             |
| La migración de tablas puede alterar filtros o acciones de negocio.             | Portar ruta por ruta y conservar contratos, permisos y pruebas funcionales existentes.                 |
| Los providers de tema y fuentes causan parpadeo o hidratación inconsistente.    | Leer paleta desde cookie, usar el patrón de hydration del proveedor y validar ambos modos.             |
| Código Clerk residual expone rutas o estados inexistentes.                      | Excluir providers, hooks, proxy y páginas Clerk; añadir búsqueda estática de imports antes de validar. |
| La fidelidad del starter vuelve inconsistente la identidad de Portal 360.       | Mantener la marca, rutas, texto de negocio y selector fijo propios del producto.                       |

## Qué no está en esta spec

- Nuevas capacidades de organización, perfil, facturación, búsqueda global de datos o
  notificaciones persistentes.
- Rediseño de procesos de Clientes, Proyectos, Requerimientos, Usuarios o Roles.
- Cambios de backend, sesiones, permisos, base de datos o migraciones.
