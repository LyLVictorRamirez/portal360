import assert from "node:assert/strict";
import test from "node:test";

import {
  createTicket,
  deleteTicket,
  getTicket,
  listTickets,
  updateTicket,
} from "./tickets-client.ts";

const ticket = {
  client: {
    code: "CLI-001",
    id: "f6323093-e2fb-4875-a787-d1542064d138",
    name: "Cliente Uno",
  },
  description: null,
  externalPriority: "medium",
  externalReference: "EXT-001",
  externalUrl: null,
  id: "5d676d8c-9939-4a25-bdda-1a4df8b17873",
  title: "Ticket Uno",
  version: 1,
} as const;

test("lists Tickets through the same-origin API with search, Client, and priority", async () => {
  let requestedUrl = "";

  const result = await listTickets(
    {
      clientId: "  f6323093-e2fb-4875-a787-d1542064d138  ",
      page: 2,
      priority: "high",
      query: "  EXT-001  ",
    },
    async (input, init) => {
      requestedUrl = input.toString();
      assert.deepEqual(init, { cache: "no-store" });
      return Response.json({ page: 2, pageSize: 25, tickets: [ticket], total: 26 });
    },
  );

  assert.equal(
    requestedUrl,
    "/api/tickets?page=2&query=EXT-001&clientId=f6323093-e2fb-4875-a787-d1542064d138&priority=high",
  );
  assert.deepEqual(result, {
    data: { page: 2, pageSize: 25, tickets: [ticket], total: 26 },
    kind: "success",
  });
});

test("gets a Ticket detail through its scoped endpoint", async () => {
  const result = await getTicket("ticket/1", async (input, init) => {
    assert.equal(input.toString(), "/api/tickets/ticket%2F1");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({ ticket });
  });

  assert.deepEqual(result, { data: ticket, kind: "success" });
});

test("creates, updates, and deletes Tickets through scoped endpoints", async () => {
  const requests: Array<{ init: RequestInit | undefined; url: string }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ init, url: input.toString() });

    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ ticket });
  };

  assert.deepEqual(
    await createTicket(
      { clientId: ticket.client.id, externalReference: "EXT-001", title: "Ticket Uno" },
      fetchImplementation,
    ),
    { data: ticket, kind: "success" },
  );
  assert.deepEqual(
    await updateTicket("ticket/1", { externalPriority: "high", version: 1 }, fetchImplementation),
    { data: ticket, kind: "success" },
  );
  assert.deepEqual(await deleteTicket("ticket/1", fetchImplementation), {
    data: undefined,
    kind: "success",
  });
  assert.deepEqual(requests, [
    {
      init: {
        body: JSON.stringify({
          clientId: ticket.client.id,
          externalReference: "EXT-001",
          title: "Ticket Uno",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      url: "/api/tickets",
    },
    {
      init: {
        body: JSON.stringify({ externalPriority: "high", version: 1 }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
      url: "/api/tickets/ticket%2F1",
    },
    { init: { method: "DELETE" }, url: "/api/tickets/ticket%2F1" },
  ]);
});

test("distinguishes unauthorized, validation, conflict, and invalid Ticket responses", async () => {
  assert.deepEqual(
    await createTicket(
      { clientId: ticket.client.id, externalReference: "EXT-001", title: "Ticket Uno" },
      async () => new Response(null, { status: 403 }),
    ),
    { kind: "unauthorized" },
  );
  assert.deepEqual(
    await updateTicket("ticket-1", { title: "Cambio", version: 1 }, async () =>
      Response.json({ message: "La URL no es válida." }, { status: 400 }),
    ),
    { kind: "validation", message: "La URL no es válida." },
  );
  assert.deepEqual(
    await updateTicket("ticket-1", { title: "Cambio", version: 1 }, async () =>
      Response.json({ message: "Recarga el Ticket." }, { status: 409 }),
    ),
    { kind: "conflict", message: "Recarga el Ticket." },
  );
  assert.deepEqual(
    await getTicket("ticket-1", async () => Response.json({ ticket: { ...ticket, version: 0 } })),
    { kind: "error", message: "La respuesta del servidor no es válida." },
  );
});
