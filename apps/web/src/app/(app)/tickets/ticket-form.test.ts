import assert from "node:assert/strict";
import test from "node:test";

import { validateTicketForm } from "./ticket-form.ts";

const validForm = {
  clientId: "f6323093-e2fb-4875-a787-d1542064d138",
  description: "  Detalle externo  ",
  externalPriority: "medium" as const,
  externalReference: "  EXT-001  ",
  externalUrl: " https://tracker.example.com/tickets/EXT-001 ",
  title: "  Falla de acceso  ",
};

test("prepares a Ticket form with normalized fields and an active Client selection", () => {
  assert.deepEqual(validateTicketForm(validForm, true), {
    kind: "valid",
    values: {
      clientId: validForm.clientId,
      description: "Detalle externo",
      externalPriority: "medium",
      externalReference: "EXT-001",
      externalUrl: "https://tracker.example.com/tickets/EXT-001",
      title: "Falla de acceso",
    },
  });
});

test("rejects missing creation fields and malformed external links before submitting", () => {
  for (const [form, message] of [
    [{ ...validForm, externalReference: "   " }, "referencia externa"],
    [{ ...validForm, title: "   " }, "título"],
    [{ ...validForm, externalUrl: "ftp://tracker.example.com/ticket" }, "URL externa"],
    [{ ...validForm, externalUrl: "https://" }, "URL externa"],
    [{ ...validForm, clientId: null }, "Cliente activo"],
  ] as const) {
    const result = validateTicketForm(form, true);
    assert.equal(result.kind, "error");
    if (result.kind === "error") {
      assert.match(result.message, new RegExp(message));
    }
  }
});

test("allows an edit without selecting a second Client", () => {
  const result = validateTicketForm({ ...validForm, clientId: null }, false);
  assert.equal(result.kind, "valid");
});
