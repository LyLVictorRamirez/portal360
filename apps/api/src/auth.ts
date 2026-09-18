import { betterAuth } from "better-auth";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";

import { loadEnvironment } from "./config/environment.js";

const environment = loadEnvironment();

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
  emailAndPassword: {
    autoSignIn: false,
    enabled: true,
    maxPasswordLength: environment.auth.passwordMaxLength,
    minPasswordLength: environment.auth.passwordMinLength,
    requireEmailVerification: true,
  },
  secret: environment.auth.secret,
  session: {
    expiresIn: 60 * 60 * 24 * 30,
  },
  trustedOrigins: [environment.webOrigin],
});
