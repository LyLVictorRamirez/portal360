# SPEC 01 — Base del monorepo

> **Status:** Aprobada
> **Depends on:** Ninguna
> **Date:** 2026-09-14
> **Objective:** Crear una base reproducible con pnpm workspaces donde las aplicaciones web y API se ejecuten y validen de forma independiente y desde la raíz.

## Por qué existe esta spec

Portal 360 necesita una base mínima y verificable antes de incorporar capacidades de negocio.

## Scope

**In:**

- Inicializar el repositorio Git y el workspace de pnpm en la raíz.
- Crear `apps/web` como aplicación Next.js con TypeScript.
- Crear `apps/api` como aplicación NestJS con TypeScript.
- Configurar scripts `dev`, `lint`, `typecheck`, `test` y `build` en cada aplicación cuando sean aplicables al framework.
- Configurar scripts de raíz que ejecuten de forma uniforme las validaciones de todas las aplicaciones.
- Configurar ESLint y Prettier para todo el workspace.
- Fijar la versión de Node en `.nvmrc` y declarar `engines` y `packageManager` en el `package.json` raíz.
- Fijar explícitamente la versión de pnpm, usar versiones exactas para dependencias directas y versionar `pnpm-lock.yaml`.
- Incluir `apps/api/.env.example` con `DATABASE_URL` como cadena de conexión PostgreSQL configurable por entorno.
- Documentar en el README los prerrequisitos, instalación y comandos de desarrollo y validación.

**Out of scope (for future specs):**

- Turborepo, paquetes compartidos y otra infraestructura de orquestación.
- Docker Compose, aprovisionamiento de PostgreSQL, migraciones, entidades TypeORM y conexión activa a base de datos.
- Autenticación mediante Microsoft Entra ID, usuarios, permisos o módulos de negocio.
- CI/CD, hosting, despliegues y gestión de secretos fuera de los archivos de ejemplo.
- SonarQube, Husky, lint-staged, requisitos de cobertura y otras herramientas adicionales de calidad.

## Modelo de configuración

Esta spec no introduce modelos de dominio ni persistencia.

La configuración mínima queda definida mediante los siguientes artefactos:

```text
.nvmrc                         # Versión exacta de Node LTS seleccionada
package.json                   # engines.node y packageManager con la versión exacta de pnpm
pnpm-workspace.yaml            # apps/* como único patrón de workspace inicial
pnpm-lock.yaml                 # Resolución reproducible de dependencias
apps/api/.env.example          # DATABASE_URL=postgresql://usuario:clave@host:5432/base
```

`DATABASE_URL` es configurable y no debe contener credenciales reales.

## Plan de implementación

1. Inicializar Git y crear el workspace con `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `.nvmrc` y la configuración de versiones; comprobar que `pnpm install --frozen-lockfile` funciona tras generar y versionar el lockfile.
2. Crear `apps/web` con la plantilla mínima de Next.js y TypeScript; añadir sus scripts de desarrollo, lint, comprobación de tipos, pruebas y build; comprobar que puede arrancar y compilar de forma aislada.
3. Crear `apps/api` con la plantilla mínima de NestJS y TypeScript; añadir sus scripts de desarrollo, lint, comprobación de tipos, pruebas y build; comprobar que puede arrancar y compilar de forma aislada.
4. Añadir configuración compartida de ESLint y Prettier en la raíz sin crear paquetes de código compartido; comprobar que ambas aplicaciones respetan el formato y las reglas.
5. Añadir los scripts de raíz `dev`, `lint`, `typecheck`, `test` y `build` para recorrer `apps/*` con filtros de pnpm; comprobar que cada validación se ejecuta para todo el workspace.
6. Añadir `apps/api/.env.example` con `DATABASE_URL` y asegurar que los archivos `.env` reales están ignorados por Git; comprobar que no se versionan secretos.
7. Actualizar `README.md` con las versiones seleccionadas, prerrequisitos, instalación, ejecución de web y API, y todos los comandos de validación; realizar la comprobación final con una instalación limpia y los scripts de raíz.

## Criterios de aceptación

- [ ] El repositorio contiene un workspace pnpm con `apps/web` y `apps/api`.
- [ ] `apps/web` inicia correctamente y sirve una aplicación Next.js con TypeScript.
- [ ] `apps/api` inicia correctamente y expone la aplicación NestJS sin errores de arranque.
- [ ] Desde la raíz, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` finalizan con código de salida 0 para todas las aplicaciones.
- [ ] Cada aplicación declara sus scripts `dev`, `lint`, `typecheck`, `test` y `build`, salvo que el framework no permita uno sin una adaptación explícitamente documentada.
- [ ] ESLint y Prettier están configurados y se pueden ejecutar desde la raíz del workspace.
- [ ] `.nvmrc`, `engines.node` y `packageManager` declaran las versiones seleccionadas de Node y pnpm.
- [ ] Todas las dependencias directas usan versiones exactas y `pnpm-lock.yaml` está versionado.
- [ ] `apps/api/.env.example` contiene `DATABASE_URL` sin credenciales reales y los archivos `.env` reales están ignorados por Git.
- [ ] El README permite a una persona con Node y pnpm instalar, arrancar y validar el proyecto desde cero.

## Decisiones

- **Sí:** pnpm workspaces con `apps/web` y `apps/api`; satisface la separación de despliegues con configuración mínima.
- **No:** Turborepo por ahora; se incorporará solo cuando los paquetes, builds o pipelines lo justifiquen.
- **No:** paquetes compartidos iniciales; se crearán únicamente ante una reutilización real.
- **Sí:** versiones estables soportadas vigentes al implementar, fijadas de forma exacta; evita actualizaciones implícitas y permite upgrades deliberados.
- **Sí:** `.nvmrc`, `engines`, `packageManager` y `pnpm-lock.yaml`; cubren desarrollo e instalaciones reproducibles sin otro gestor de versiones.
- **Sí:** `DATABASE_URL` en un archivo de ejemplo; permite elegir PostgreSQL local o en nube sin acoplar la base del proyecto a un proveedor.
- **No:** Docker Compose y conexión activa a PostgreSQL; no son necesarios para demostrar que web y API arrancan.
- **Sí:** ESLint, Prettier y validaciones básicas desde el inicio; son calidad de base y no arquitectura adicional.
- **No:** herramientas adicionales de calidad o automatización; se aplazan para preservar KISS y YAGNI.
- **No:** Microsoft Entra ID en esta spec; pertenece a una capacidad de identidad posterior.

## Riesgos

| Riesgo                                                                       | Mitigación                                                                                                           |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Incompatibilidad entre las versiones seleccionadas de Node, Next.js y NestJS | Verificar la matriz de soporte vigente antes de fijar las versiones y ejecutar todas las validaciones tras instalar. |
| Diferencias de entorno entre desarrolladores                                 | Fijar Node, pnpm y el lockfile, y documentar el flujo de instalación limpio.                                         |
| Exposición accidental de secretos                                            | Versionar solo `.env.example` y mantener `.env` fuera de Git.                                                        |

## Qué **no** está en esta spec

- Base de datos PostgreSQL operativa, TypeORM o migraciones.
- Autenticación y autorización.
- Funcionalidad del dominio de Portal 360.
- Turborepo, paquetes compartidos, CI/CD o despliegue.
