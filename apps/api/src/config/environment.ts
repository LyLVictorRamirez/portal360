import "dotenv/config";

const DEFAULT_PASSWORD_MIN_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export interface SmtpEnvironment {
  from: string;
  host: string;
  password: string;
  port: number;
  secure: boolean;
  user: string;
}

export interface AppEnvironment {
  auth: {
    passwordMaxLength: number;
    passwordMinLength: number;
    secret: string;
    url: string;
  };
  databaseUrl: string;
  isProduction: boolean;
  smtp?: SmtpEnvironment;
  webOrigin: string;
}

type EnvironmentValues = NodeJS.ProcessEnv;

export function loadEnvironment(environment: EnvironmentValues = process.env): AppEnvironment {
  const databaseUrl = readPostgresUrl(environment, "DATABASE_URL");
  const secret = readSecret(environment);
  const authUrl = readHttpUrl(environment, "BETTER_AUTH_URL");
  const webOrigin = readOrigin(environment, "WEB_ORIGIN");

  return {
    auth: {
      passwordMaxLength: MAX_PASSWORD_LENGTH,
      passwordMinLength: readPasswordMinLength(environment),
      secret,
      url: authUrl,
    },
    databaseUrl,
    isProduction: environment.NODE_ENV === "production",
    smtp: readSmtp(environment),
    webOrigin,
  };
}

function readRequired(environment: EnvironmentValues, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Invalid environment configuration: ${name} is required.`);
  }

  return value;
}

function readPostgresUrl(environment: EnvironmentValues, name: string): string {
  const value = readRequired(environment, name);

  try {
    const url = new URL(value);

    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      throw new Error("Unsupported protocol");
    }
  } catch {
    throw new Error(`Invalid environment configuration: ${name} must be a PostgreSQL URL.`);
  }

  return value;
}

function readSecret(environment: EnvironmentValues): string {
  const secret = readRequired(environment, "BETTER_AUTH_SECRET");

  if (secret.length < 32) {
    throw new Error(
      "Invalid environment configuration: BETTER_AUTH_SECRET must contain at least 32 characters.",
    );
  }

  return secret;
}

function readHttpUrl(environment: EnvironmentValues, name: string): string {
  const value = readRequired(environment, name);

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid environment configuration: ${name} must be an HTTP(S) URL.`);
  }
}

function readOrigin(environment: EnvironmentValues, name: string): string {
  const value = readHttpUrl(environment, name);
  const url = new URL(value);

  if (url.origin !== value) {
    throw new Error(`Invalid environment configuration: ${name} must be an origin without a path.`);
  }

  return value;
}

function readPasswordMinLength(environment: EnvironmentValues): number {
  const value = environment.AUTH_PASSWORD_MIN_LENGTH?.trim();

  if (!value) {
    return DEFAULT_PASSWORD_MIN_LENGTH;
  }

  const passwordMinLength = Number(value);

  if (
    !Number.isInteger(passwordMinLength) ||
    passwordMinLength < DEFAULT_PASSWORD_MIN_LENGTH ||
    passwordMinLength > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(
      `Invalid environment configuration: AUTH_PASSWORD_MIN_LENGTH must be an integer between ${DEFAULT_PASSWORD_MIN_LENGTH} and ${MAX_PASSWORD_LENGTH}.`,
    );
  }

  return passwordMinLength;
}

function readSmtp(environment: EnvironmentValues): SmtpEnvironment | undefined {
  const names = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ];
  const configuredNames = names.filter((name) => environment[name]?.trim());

  if (configuredNames.length === 0) {
    return undefined;
  }

  if (configuredNames.length !== names.length) {
    throw new Error("Invalid environment configuration: all SMTP variables must be set together.");
  }

  const port = Number(readRequired(environment, "SMTP_PORT"));
  const secure = readRequired(environment, "SMTP_SECURE");

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid environment configuration: SMTP_PORT must be a valid port number.");
  }

  if (secure !== "true" && secure !== "false") {
    throw new Error("Invalid environment configuration: SMTP_SECURE must be true or false.");
  }

  return {
    from: readRequired(environment, "SMTP_FROM"),
    host: readRequired(environment, "SMTP_HOST"),
    password: readRequired(environment, "SMTP_PASSWORD"),
    port,
    secure: secure === "true",
    user: readRequired(environment, "SMTP_USER"),
  };
}
