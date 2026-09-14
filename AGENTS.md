# Repository Guidelines

## Project Structure & Module Organization

Portal 360 is a pnpm workspace monorepo. `apps/web` contains the Next.js App Router frontend; route files live in `apps/web/src/app`. `apps/api` contains the NestJS API, with the bootstrap in `src/main.ts`, modules in `src/*.module.ts`, and controllers in `src/*.controller.ts`. Shared packages do not exist yet—add one only when real reuse justifies it. Project decisions and delivery scope live in `specs/`; read the relevant approved spec before changing behavior.

Generated output (`.next/`, `dist/`, `coverage/`, `node_modules/`) is ignored. Never commit real `.env` files. Use `apps/api/.env.example` as the safe template for `DATABASE_URL`.

## Build, Test, and Development Commands

Use Node `24.21.0` and pnpm `12.4.1`, both pinned in the root files. Run commands from the repository root:

```powershell
corepack pnpm install --frozen-lockfile  # reproducible install
corepack pnpm dev                        # web :3000 and API :3001
corepack pnpm lint                       # lint every app
corepack pnpm typecheck                  # TypeScript checks
corepack pnpm test                       # Node test runner per app
corepack pnpm build                      # production builds
corepack pnpm format:check               # verify Prettier formatting
```

Run one application with `corepack pnpm --filter @portal-360/web dev` or `@portal-360/api`.

## Coding Style & Naming Conventions

Use TypeScript, double quotes, semicolons, trailing commas, and 100-column lines; Prettier enforces these choices. ESLint applies the shared JavaScript and TypeScript recommended rules. Use kebab-case for new filenames when a framework does not impose a convention. Nest classes use PascalCase (`AppModule`); controller and module filenames use `*.controller.ts` and `*.module.ts`. Keep UI routes inside `src/app` and avoid premature shared abstractions.

## Testing Guidelines

Tests run through Node's built-in test runner. Add focused `*.test.ts` files alongside the unit they cover when test coverage is introduced. There is no coverage threshold yet. Always run `lint`, `typecheck`, `test`, and `build` before requesting review.

## Commit & Pull Request Guidelines

Current history uses `SpecNN - Paso NN Descripción breve` (for example, `Spec01 - Paso 03 Crear apps/api`). Keep commits scoped to one implementation step. Pull requests should state the linked spec or issue, summarize behavior and validation commands, and include screenshots for visible frontend changes. Do not commit generated files, secrets, or unrelated formatting changes.
