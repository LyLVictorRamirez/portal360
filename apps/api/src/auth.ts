import { betterAuth } from "better-auth";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

import { AuthEmailService } from "./auth-email.service.js";
import { loadEnvironment } from "./config/environment.js";

const environment = loadEnvironment();
const authEmailService = new AuthEmailService(environment);

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
  secret: environment.auth.secret,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  trustedOrigins: [environment.webOrigin],
});
