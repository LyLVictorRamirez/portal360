import assert from "node:assert/strict";
import test from "node:test";

import { loadEnvironment } from "./environment.js";

const validEnvironment = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3001",
  DATABASE_URL: "postgresql://portal:password@localhost:5432/portal_360",
  WEB_ORIGIN: "http://localhost:3000",
};

test("loads the default Better Auth password policy without SMTP", () => {
  const environment = loadEnvironment(validEnvironment);

  assert.equal(environment.auth.passwordMinLength, 8);
  assert.equal(environment.auth.passwordMaxLength, 128);
  assert.equal(environment.smtp, undefined);
});

test("rejects a short Better Auth secret without exposing its value", () => {
  assert.throws(
    () => loadEnvironment({ ...validEnvironment, BETTER_AUTH_SECRET: "not-a-real-secret" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /BETTER_AUTH_SECRET/);
      assert.doesNotMatch(error.message, /not-a-real-secret/);
      return true;
    },
  );
});

test("requires SMTP variables to be configured together", () => {
  assert.throws(
    () => loadEnvironment({ ...validEnvironment, SMTP_HOST: "smtp.example.test" }),
    /all SMTP variables must be set together/,
  );
});

test("loads a complete SMTP configuration", () => {
  const environment = loadEnvironment({
    ...validEnvironment,
    SMTP_FROM: "Portal 360 <no-reply@example.test>",
    SMTP_HOST: "smtp.example.test",
    SMTP_PASSWORD: "not-a-real-password",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "portal-360",
  });

  assert.deepEqual(environment.smtp, {
    from: "Portal 360 <no-reply@example.test>",
    host: "smtp.example.test",
    password: "not-a-real-password",
    port: 465,
    secure: true,
    user: "portal-360",
  });
});
