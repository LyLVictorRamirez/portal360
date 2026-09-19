# Repository Guidelines

## Overview and Structure

Portal 360 is an internal work-management application. It is a pnpm workspace monorepo:

- `apps/web`: Next.js App Router frontend. Routes live in `src/app`, reusable UI in
  `src/components`, and client/server helpers in `src/lib`.
- `apps/api`: NestJS modular-monolith API. Bootstrap is `src/main.ts`; authorization code lives in
  `src/authorization`; database migrations live in `migrations/`.
- `specs`: the functional source of truth for delivery scope and decisions. Read the relevant spec
  before changing behavior. Implement only specs whose status permits development.

`apps/web/AGENTS.md` contains additional, mandatory Next.js guidance. Read it before modifying the
frontend. Do not introduce a shared package, microservice, CQRS, event sourcing, queue, or another
architectural layer without a demonstrated requirement.

## Local Development

Use Node `24.21.0` and pnpm `12.4.1`, as pinned in `.nvmrc` and `package.json`. Run commands from
the repository root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm format:check
```

Run one app with `corepack pnpm --filter @portal-360/web <script>` or
`corepack pnpm --filter @portal-360/api <script>`. The web app runs on port 3000 and the API on
port 3001.

The API uses Better Auth for identity and its own PostgreSQL `authorization` schema for RBAC.
When database-backed work is involved, use the provided scripts deliberately:

```powershell
corepack pnpm --filter @portal-360/api auth:migrate
corepack pnpm --filter @portal-360/api authorization:migrate
corepack pnpm --filter @portal-360/api authorization:bootstrap-admin <verified-email>
```

Never commit `.env` files, credentials, or generated output (`node_modules`, `.next`, `dist`,
`coverage`, `.test-dist`). Use each app's `.env.example` as the safe template.

## Engineering Conventions

- Use TypeScript, double quotes, semicolons, trailing commas, and 100-column lines. Let Prettier
  and ESLint enforce formatting rather than making unrelated formatting changes.
- Use kebab-case for new filenames unless the framework requires a different name. Nest classes are
  PascalCase; Nest modules and controllers use `*.module.ts` and `*.controller.ts`.
- Keep UI routes in `apps/web/src/app`; do not bypass the application's typed helpers and shared UI
  components when a suitable one already exists.
- Add focused `*.test.ts` tests alongside the unit or behavior changed. Tests use Node's built-in
  test runner.
- Preserve authorization boundaries: Better Auth owns identity, credentials, and sessions; Portal
  360 RBAC owns role and permission data. Do not place authorization claims in sessions or expose
  audit data unless a spec explicitly requires it.
- Treat migrations and authorization changes as security-sensitive. Preserve idempotency,
  transactional integrity, least privilege, and the documented system-role invariants.

## Delivery Workflow

Before requesting review, run the relevant focused tests and, for a complete implementation,
`lint`, `typecheck`, `test`, `build`, and `format:check` from the root. Report any validation not
run and why.

Keep commits scoped to one implementation step. Follow the existing convention:
`SpecNN - Paso NN Descripción breve`. Pull requests should identify the relevant spec, summarize the
behavior and validation, and include screenshots for visible frontend changes. Do not include
unrelated edits.
