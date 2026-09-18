import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

import { AuthEmailService } from "./auth-email.service.js";
import {
  AUTH_RATE_LIMIT_MESSAGE,
  AuthEmailRateLimiter,
  authIpRateLimitRules,
  isAuthEmailRateLimitPath,
} from "./auth-rate-limit.js";
import { loadEnvironment } from "./config/environment.js";

const environment = loadEnvironment();
const authEmailService = new AuthEmailService(environment);
const authEmailRateLimiter = new AuthEmailRateLimiter();

export const authDatabasePool = new Pool({
  connectionString: environment.databaseUrl,
});

export const auth = betterAuth({
  baseURL: environment.auth.url,
  database: {
    dialect: new PostgresDialect({
      pool: authDatabasePool,
    }),
    schemaName: "auth",
    type: "postgres",
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) =>
      authEmailService.sendVerificationEmail({
        email: user.email,
        name: user.name,
        url,
      }),
  },
  emailAndPassword: {
    autoSignIn: false,
    enabled: true,
    maxPasswordLength: environment.auth.passwordMaxLength,
    minPasswordLength: environment.auth.passwordMinLength,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) =>
      authEmailService.sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        url,
      }),
  },
  hooks: {
    before: createAuthMiddleware(async (context) => {
      if (!isAuthEmailRateLimitPath(context.path)) {
        return;
      }

      const result = authEmailRateLimiter.consume(context.path, context.body?.email);

      if (!result.allowed) {
        return context.json(
          { message: AUTH_RATE_LIMIT_MESSAGE },
          {
            headers: { "Retry-After": String(result.retryAfter) },
            status: 429,
          },
        );
      }
    }),
  },
  rateLimit: {
    customRules: authIpRateLimitRules,
    enabled: true,
    storage: "database",
  },
  secret: environment.auth.secret,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  trustedOrigins: [environment.webOrigin],
});
