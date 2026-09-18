import assert from "node:assert/strict";
import test from "node:test";

import {
  maximumPasswordLength,
  minimumPasswordLength,
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "./auth-form-validation.ts";

test("validates the public registration fields", () => {
  assert.equal(validateName("   "), "Escribe tu nombre.");
  assert.equal(validateName("Ana García"), undefined);
  assert.equal(validateEmail(""), "Escribe tu correo electrónico.");
  assert.equal(validateEmail("invalid-email"), "Escribe un correo electrónico válido.");
  assert.equal(validateEmail(" ana@example.test "), undefined);
});

test("enforces the configured password range and confirmation", () => {
  assert.equal(
    validatePassword("a".repeat(minimumPasswordLength - 1)),
    `La contraseña debe tener al menos ${minimumPasswordLength} caracteres.`,
  );
  assert.equal(validatePassword("a".repeat(minimumPasswordLength)), undefined);
  assert.equal(
    validatePassword("a".repeat(maximumPasswordLength + 1)),
    `La contraseña no puede superar ${maximumPasswordLength} caracteres.`,
  );
  assert.equal(
    validatePasswordConfirmation("password-1", "password-2"),
    "Las contraseñas deben coincidir.",
  );
  assert.equal(validatePasswordConfirmation("password-1", "password-1"), undefined);
});
