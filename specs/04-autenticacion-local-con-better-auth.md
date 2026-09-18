# SPEC 04 — Autenticación local con Better Auth

> **Status:** Implementada
> **Depends on:** SPEC 01, SPEC 03
> **Date:** 2026-09-17
> **Objective:** Implementar autenticación local basada en Better Auth con registro público, verificación de correo, recuperación de contraseña y sesiones de 30 días gestionadas por `apps/api`.

## Por qué existe esta spec

Portal 360 necesita identificar de forma segura a las personas que usan el Application Shell antes de incorporar módulos de negocio.

La autenticación local permite validar el ciclo completo de acceso sin bloquear el futuro inicio de sesión con Microsoft Entra ID.

## Scope

**In:**

- Instalar y configurar Better Auth dentro de `apps/api` como propietario de usuarios, credenciales, sesiones y tokens de verificación.
- Conectar Better Auth directamente a PostgreSQL mediante `pg` y mantener sus tablas en el esquema `auth`.
- Generar y aplicar las migraciones de Better Auth mediante su CLI, sin crear entidades TypeORM para datos de autenticación.
- Habilitar registro público con nombre, correo único, contraseña y confirmación de contraseña.
- Aplicar una longitud mínima de contraseña configurable, con valor inicial de 8 caracteres y máximo de 128 caracteres.
- Exigir la verificación del correo antes de permitir el inicio de sesión y el acceso a rutas privadas.
- Enviar correos de verificación y restablecimiento mediante SMTP configurado exclusivamente con variables de entorno.
- Registrar el enlace de correo solo en desarrollo cuando SMTP no esté configurado y devolver un error controlado en producción.
- Habilitar inicio y cierre de sesión, recuperación de contraseña y revocación de todas las sesiones al completar un restablecimiento.
- Crear sesiones persistentes de 30 días con cookies seguras de solo HTTP y atributos adecuados para el mismo sitio.
- Limitar los flujos públicos de registro, inicio de sesión y recuperación por dirección IP y correo, sin incorporar CAPTCHA.
- Exponer los endpoints de autenticación de NestJS a través de `/api/auth/*` en `apps/web` mediante una reescritura de Next.js.
- Proteger el grupo de rutas `apps/web/src/app/(app)` y redirigir al Login con una URL de retorno segura cuando no exista sesión.
- Convertir `/login` en un acceso funcional y crear las vistas públicas de registro, verificación de correo, recuperación y restablecimiento de contraseña.
- Mostrar la identidad de la sesión en la Top Bar y ofrecer cierre de sesión funcional.

**Out of scope (for future specs):**

- Microsoft Entra ID, inicio de sesión social, SSO, cuentas externas y vinculación de proveedores.
- Roles Administrador, Líder o Miembro, permisos, autorización de endpoints y administración de usuarios.
- Invitaciones, aprobación manual de cuentas, restricción por dominio o flujos de alta corporativa.
- Doble factor, passkeys, CAPTCHA, dispositivos de confianza y gestión detallada de sesiones.
- Edición de perfil, avatar, cambio de correo, eliminación de cuenta y auditoría de seguridad.
- Plantillas corporativas avanzadas, proveedor transaccional concreto distinto de SMTP y campañas de correo.

## Modelo de datos y configuración

Better Auth será la única fuente de persistencia de identidad durante esta fase.

Usará PostgreSQL con `DATABASE_URL` y el esquema dedicado `auth`.

La migración de Better Auth creará como mínimo las tablas siguientes:

| Tabla               | Datos persistidos                                                                      | Uso                                                   |
| ------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `auth.user`         | `id`, `name`, `email`, `email_verified`, marcas de creación y actualización            | Identidad local única por correo.                     |
| `auth.account`      | `id`, `user_id`, `provider_id`, `account_id`, hash de contraseña y marcas de tiempo    | Credencial de correo y contraseña.                    |
| `auth.session`      | `id`, `user_id`, token, expiración, dirección IP, agente de usuario y marcas de tiempo | Sesión persistente de 30 días.                        |
| `auth.verification` | `id`, identificador, valor de un solo uso, expiración y marcas de tiempo               | Enlaces de verificación de correo y restablecimiento. |

No se crearán tablas de roles, permisos, perfiles de negocio ni entidades TypeORM en esta spec.

`apps/api/.env.example` documentará estas variables sin valores reales:

```text
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
WEB_ORIGIN
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
```

`BETTER_AUTH_SECRET`, `DATABASE_URL` y las credenciales SMTP nunca se expondrán a `apps/web` ni se incluirán en el repositorio.

La reescritura de Next.js usará una variable de servidor para el origen interno de `apps/api`.

## Plan de implementación

1. Actualizar `apps/api/package.json` con Better Auth, su integración para NestJS, `pg` y el transporte SMTP; añadir scripts de generación y migración de Better Auth; comprobar que la API continúa iniciando con la ruta de salud existente.
2. Crear la configuración tipada de entorno en `apps/api`, ampliar `apps/api/.env.example` y validar las variables obligatorias de base de datos, secreto y origen; comprobar que las credenciales no aparecen en respuestas ni registros.
3. Crear `apps/api/src/auth.ts` con Better Auth, conexión `pg`, esquema `auth`, registro público, credenciales de correo y contraseña, mínimo configurable de 8 caracteres, verificación obligatoria y expiración de sesión de 30 días; comprobar que la configuración puede generar su esquema.
4. Ejecutar la generación y migración de Better Auth contra PostgreSQL y registrar el procedimiento en los scripts del paquete; comprobar que existen `auth.user`, `auth.account`, `auth.session` y `auth.verification`.
5. Crear el servicio SMTP de `apps/api` para los enlaces de verificación y recuperación; comprobar que envía con SMTP configurado, registra enlaces únicamente en desarrollo sin SMTP y falla de forma controlada en producción sin SMTP.
6. Registrar Better Auth en `apps/api/src/main.ts` y `apps/api/src/app.module.ts`, incluyendo la configuración requerida para que NestJS entregue los cuerpos originales a Better Auth; comprobar registro, verificación, inicio, cierre y recuperación mediante sus endpoints.
7. Añadir límites a los endpoints públicos de autenticación por IP y correo, con respuestas genéricas que no revelen si un correo está registrado; comprobar bloqueo temporal al superar el límite y recuperación tras su ventana.
8. Configurar `apps/web/next.config.ts` para reenviar exclusivamente `/api/auth/:path*` al origen interno de `apps/api`; comprobar que las cookies de sesión se reciben desde el mismo origen del navegador.
9. Añadir el cliente y las utilidades de sesión de Better Auth en `apps/web`, incluyendo consulta de sesión del lado servidor con las cookies de la solicitud; comprobar que la sesión se puede leer sin exponer secretos al cliente.
10. Reemplazar el contenido informativo de `apps/web/src/app/(public)/login/page.tsx` y crear rutas públicas para registro, verificación de correo, recuperación y restablecimiento; comprobar validaciones visibles, estados pendientes, enlaces de retorno y mensajes seguros de error.
11. Proteger `apps/web/src/app/(app)/layout.tsx` con la sesión del backend y redirigir a `/login` cuando falte o no esté verificada; comprobar que la URL de retorno solo conserva rutas internas válidas.
12. Actualizar `apps/web/src/components/layout/top-bar.tsx` para mostrar nombre y correo de la sesión y cerrar la sesión; comprobar que el cierre invalida la cookie y lleva a `/login`.
13. Añadir pruebas focalizadas de configuración, protección de rutas y flujos de registro, verificación, recuperación, restablecimiento y cierre de sesión; comprobar que los comandos de validación del monorepo siguen siendo ejecutables.

## Criterios de aceptación

- [ ] `apps/api` aloja Better Auth y `apps/web` no contiene secretos, credenciales SMTP ni acceso directo a PostgreSQL.
- [ ] Una migración de Better Auth crea o actualiza el esquema `auth` con las tablas de usuario, cuenta, sesión y verificación.
- [ ] Un visitante puede registrarse con nombre, correo y una contraseña de entre el mínimo configurable de 6 y 128 caracteres.
- [ ] Un correo duplicado no crea una segunda identidad y la respuesta no expone datos sensibles.
- [ ] Un usuario recién registrado no puede acceder a `/` hasta verificar su correo mediante un enlace de un solo uso.
- [ ] Con SMTP configurado, el registro entrega un correo de verificación y la recuperación entrega un correo de restablecimiento.
- [ ] Sin SMTP, el desarrollo registra el enlace de prueba y producción responde con un error controlado sin afirmar que el correo existe.
- [ ] Un restablecimiento válido actualiza la contraseña y revoca todas las sesiones previas de ese usuario.
- [ ] Una sesión autenticada persiste durante 30 días y el cierre de sesión la invalida.
- [ ] Los intentos repetidos de registro, inicio de sesión o recuperación reciben un límite temporal por IP y correo.
- [ ] El navegador llama a `/api/auth/*` y Next.js lo reenvía a `apps/api` sin requerir llamadas del navegador al puerto del backend.
- [ ] `/login`, registro, verificación, recuperación y restablecimiento se renderizan fuera del Application Shell.
- [ ] Una solicitud sin sesión o con correo no verificado a `/` redirige a `/login` y conserva únicamente una URL de retorno interna.
- [ ] La Top Bar muestra la identidad de la sesión y su acción de cierre de sesión funciona.
- [ ] La interfaz conserva los componentes, tokens y requisitos de accesibilidad definidos en SPEC 03.
- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` y `corepack pnpm format:check` finalizan con código 0 desde la raíz.

## Decisiones

- **Sí:** Better Auth dentro de `apps/api`; el backend conserva la autoridad sobre sesiones, credenciales y tokens.
- **No:** Better Auth dentro de `apps/web`; duplicaría la responsabilidad de autenticación y expondría más superficie de integración.
- **Sí:** PostgreSQL mediante `pg` y el esquema dedicado `auth`; aísla las tablas de Better Auth de los futuros modelos de negocio.
- **No:** entidades TypeORM para autenticación; Better Auth administra su propio esquema y sus migraciones.
- **Sí:** registro público; permite validar el flujo completo de usuario y contraseña durante esta fase.
- **No:** invitaciones o aprobación manual; requieren administración de usuarios y autorización que pertenecen a otra spec.
- **Sí:** verificación obligatoria de correo y recuperación por SMTP; confirma la propiedad del correo y permite recuperar el acceso.
- **Sí:** desarrollo registra enlaces si no hay SMTP y producción falla de forma controlada; facilita pruebas locales sin ocultar una configuración incompleta en despliegue.
- **Sí:** contraseña mínima configurable con valor inicial de 8 caracteres; respeta la decisión de producto y permite endurecerla sin cambiar el código.
- **Sí:** sesión de 30 días y revocación total tras restablecer la contraseña; combina persistencia de acceso y contención ante credenciales comprometidas.
- **Sí:** proxy limitado a `/api/auth/*` mediante reescritura de Next.js; el navegador conserva un único origen y evita CORS para la sesión.
- **No:** Microsoft Entra ID, roles y permisos; se definirán en specs independientes cuando exista el modelo de autorización.

## Riesgos

| Riesgo                                                                    | Mitigación                                                                                                             |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| El registro público recibe automatización o intentos repetidos.           | Limitar registro, inicio y recuperación por IP y correo; dejar CAPTCHA para una fase posterior si el tráfico lo exige. |
| Una contraseña mínima de 8 caracteres reduce la resistencia ante ataques. | Hacer el mínimo configurable, limitar intentos y exigir verificación de correo.                                        |
| SMTP no está configurado o entrega correos tarde.                         | Documentar variables, registrar enlaces solo en desarrollo y devolver errores operativos controlados en producción.    |
| La cuenta queda sin verificar y el usuario no entiende el siguiente paso. | Mostrar estado de espera, reenvío limitado y mensajes claros sin permitir acceso privado.                              |
| El rol PostgreSQL no puede crear el esquema `auth`.                       | Validar permisos antes de ejecutar la migración y documentar el requisito de `CREATE` y acceso al esquema.             |
| Un despliegue configura mal el proxy o los atributos de cookie.           | Probar registro, sesión, cierre y redirección en el dominio final además de localhost.                                 |
| La sesión de 30 días permanece en un equipo compartido.                   | Ofrecer cierre de sesión visible y revocar todas las sesiones después de restablecer la contraseña.                    |

## Qué **no** está en esta spec

- Microsoft Entra ID, SSO, proveedores sociales o cuentas vinculadas.
- Roles, permisos, administración de usuarios, invitaciones o restricción por dominio.
- Doble factor, passkeys, CAPTCHA, auditoría o gestión avanzada de dispositivos.
- Perfil editable, avatar, cambio de correo, borrado de cuenta o módulos de negocio.
