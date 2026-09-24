# Portal 360 — Guía para agentes

## Propósito y arquitectura

Portal 360 es una aplicación interna para coordinar el trabajo de consultoría y desarrollo:
clientes, proyectos, requerimientos, tickets, actividades y su configuración operativa.

Es un monorepo de `pnpm` con TypeScript y dos aplicaciones independientes:

- `apps/web`: frontend Next.js 16 con App Router y React 19. Las rutas están en `src/app`, los
  componentes reutilizables en `src/components`, y los clientes, utilidades y ayudas de servidor
  en `src/lib`.
- `apps/api`: API NestJS 12 organizada como monolito modular. Arranca en `src/main.ts`; cada
  dominio mantiene contratos, controlador, servicio, repositorio, módulo y pruebas cercanas.
- `specs`: fuente funcional de verdad. Las specs definen alcance, reglas, contratos, decisiones y
  criterios de aceptación. `specs/docs/modelo-datos.md` es referencia complementaria, no sustituye
  una spec aprobada.

El backend usa PostgreSQL con Kysely. Better Auth es dueño de identidad, credenciales y sesiones;
el esquema PostgreSQL `authorization` es dueño de roles y permisos de Portal 360. El frontend llama
a la API mediante rutas `/api/*` reescritas por `apps/web/next.config.ts`, no directamente a una
URL del backend desde los componentes.

Mantén el monolito modular y aplica KISS/YAGNI. No introduzcas paquetes compartidos, microservicios,
CQRS, event sourcing, colas, múltiples bases de datos u otras capas arquitectónicas sin un requisito
demostrado por una spec aprobada.

## Antes de cambiar código

1. Revisa la spec pertinente en `specs/` y verifica que esté aprobada o en estado que permita su
   implementación. No implementes decisiones funcionales desde el README ni supongas requisitos.
2. Lee primero el código del dominio o ruta afectada y sus pruebas. Conserva patrones y contratos
   existentes antes de crear abstracciones nuevas.
3. Si el cambio toca `apps/web`, lee obligatoriamente `apps/web/AGENTS.md`. Next.js mantiene allí
   instrucciones generadas que deben conservarse.
4. Si el cambio toca migraciones, permisos, autenticación o sesiones, trátalo como sensible a
   seguridad: valida invariantes, idempotencia, transacciones y privilegio mínimo.

## Entorno y comandos

Usa Node.js `24.21.0` y pnpm `12.4.1`, fijados en `.nvmrc` y `package.json`. Ejecuta desde la raíz:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm format:check
```

Las aplicaciones se ejecutan normalmente en:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

Para trabajar sobre una aplicación individual, usa:

```powershell
corepack pnpm --filter @portal-360/web <script>
corepack pnpm --filter @portal-360/api <script>
```

Los scripts de datos de la API son deliberados y no deben ejecutarse por rutina:

```powershell
corepack pnpm --filter @portal-360/api auth:generate
corepack pnpm --filter @portal-360/api auth:migrate
corepack pnpm --filter @portal-360/api authorization:migrate
corepack pnpm --filter @portal-360/api business:migrate
corepack pnpm --filter @portal-360/api authorization:bootstrap-admin <correo-verificado>
```

Las variables requeridas de la API están documentadas en `apps/api/.env.example`; entre ellas están
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y `WEB_ORIGIN`. La configuración del
frontend está en `apps/web/.env.example` (`API_ORIGIN`). Nunca incluyas secretos, archivos `.env` o
valores de producción en código, pruebas, commits o salidas de comandos.

## Convenciones de implementación

- Usa TypeScript, comillas dobles, punto y coma, comas finales y líneas de hasta 100 columnas.
  Deja que Prettier y ESLint apliquen el formato; evita reformateos no relacionados.
- Usa nombres de archivos en kebab-case cuando el framework no determine otro. Las clases Nest son
  PascalCase; módulos y controladores usan `*.module.ts` y `*.controller.ts`.
- Añade o actualiza pruebas `*.test.ts` junto al comportamiento cambiado. El repositorio usa el
  ejecutor de pruebas nativo de Node; la API compila sus pruebas a `.test-dist` antes de ejecutarlas.
- Mantén los contratos en `*.contracts.ts` y no expongas detalles de persistencia a los controladores
  ni al frontend.
- Reutiliza los helpers tipados, componentes y clientes ya disponibles. En web, las páginas de
  dominio viven bajo `src/app/(app)` y la interfaz pública/autenticación bajo `src/app/(public)`.
- Al añadir un dominio de API, sigue la composición modular existente y registra el módulo en
  `apps/api/src/app.module.ts`. Si expone una ruta consumida por web, añade explícitamente el rewrite
  correspondiente en `apps/web/next.config.ts`.

## Seguridad y datos

- Better Auth conserva identidad, credenciales y sesión. No agregues claims de autorización a la
  sesión ni dupliques esos datos en el esquema de RBAC.
- Los permisos de Portal 360 se resuelven en `apps/api/src/authorization`. Protege rutas mediante
  el guard y decoradores existentes; no confíes en restricciones solo de interfaz.
- No expongas datos de auditoría ni habilites restauración, borrado físico o escalamiento de
  privilegios si una spec no lo ordena explícitamente.
- Para cambios de datos, crea migraciones numeradas en `apps/api/migrations/` y preserva su
  idempotencia, integridad transaccional y compatibilidad con instalaciones existentes.
- No modifiques scripts de migración, permisos del sistema o bootstrap de administradores sin pruebas
  focalizadas que cubran las invariantes relevantes.

## Validación y entrega

Ejecuta primero las pruebas focalizadas del área modificada. Para una implementación completa, antes
de solicitar revisión ejecuta desde la raíz:

```powershell
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm format:check
```

Informa siempre qué validaciones se ejecutaron y cuáles no, con el motivo. Para cambios visuales,
incluye evidencia visual. Conserva los commits pequeños y acotados a un paso de implementación; usa
el formato `SpecNN - Paso NN Descripción breve`. Una solicitud de revisión debe indicar la spec,
el comportamiento entregado, la validación ejecutada y cualquier limitación conocida.

No confirmes ni alteres cambios ajenos. No incluyas archivos generados o locales: `node_modules`,
`.next`, `dist`, `coverage`, `.test-dist`, `*.tsbuildinfo`, logs, `.env` y ajustes de editor.
