import assert from "node:assert/strict";
import test from "node:test";

import { AuthEmailService, EmailDeliveryUnavailableError } from "./auth-email.service.js";
import type { AppEnvironment } from "./config/environment.js";

const message = {
  email: "member@example.test",
  name: "Portal Member",
  url: "http://localhost:3001/verify-email?token=one-time-token",
};

const developmentEnvironment: AppEnvironment = {
  auth: {
    passwordMaxLength: 128,
    passwordMinLength: 8,
    secret: "a".repeat(32),
    url: "http://localhost:3001",
  },
  databaseUrl: "postgresql://portal:password@localhost:5432/portal_360",
  isProduction: false,
  webOrigin: "http://localhost:3000",
};

test("logs verification links only in development when SMTP is absent", async () => {
  const logs: string[] = [];
  const service = new AuthEmailService(
    developmentEnvironment,
    { error: () => undefined, log: (entry) => logs.push(entry) },
    undefined,
  );

  await service.sendVerificationEmail(message);

  assert.equal(logs.length, 1);
  assert.match(logs[0], /Development email verification link/);
  assert.match(logs[0], /one-time-token/);
});

test("returns a controlled error in production when SMTP is absent", async () => {
  const service = new AuthEmailService(
    { ...developmentEnvironment, isProduction: true },
    { error: () => undefined, log: () => undefined },
    undefined,
  );

  await assert.rejects(
    service.sendPasswordResetEmail(message),
    (error: unknown) => error instanceof EmailDeliveryUnavailableError,
  );
});

test("sends password reset emails through the configured transport", async () => {
  const delivered: Array<{
    from?: string | undefined;
    subject?: string;
    text?: string;
    to?: string;
  }> = [];
  const service = new AuthEmailService(
    {
      ...developmentEnvironment,
      smtp: {
        from: "Portal 360 <no-reply@example.test>",
        host: "smtp.example.test",
        password: "not-a-real-password",
        port: 465,
        secure: true,
        user: "portal-360",
      },
    },
    { error: () => undefined, log: () => undefined },
    {
      sendMail: async ({ from, subject, text, to }) => {
        delivered.push({
          from: typeof from === "string" ? from : undefined,
          subject,
          text: typeof text === "string" ? text : undefined,
          to: typeof to === "string" ? to : undefined,
        });
      },
    },
  );

  await service.sendPasswordResetEmail(message);

  assert.deepEqual(delivered, [
    {
      from: "Portal 360 <no-reply@example.test>",
      subject: "Restablece tu contraseña de Portal 360",
      text: `Hola Portal Member,\n\nRestablece tu contraseña de Portal 360: ${message.url}\n\nSi no solicitaste este cambio, puedes ignorar este correo.`,
      to: "member@example.test",
    },
  ]);
});
