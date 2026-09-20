import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequirement,
  deleteRequirement,
  getRequirement,
  getRequirementCodeSettings,
  listRequirements,
  updateRequirement,
  updateRequirementCodeSettings,
} from "./requirements-client.ts";

const requirement = {
  approvedByUserId: null,
  approvedOn: null,
  client: {
    code: "CLI-001",
    id: "f6323093-e2fb-4875-a787-d1542064d138",
    name: "Cliente Uno",
  },
  code: "REQ-001",
  committedOn: null,
  description: null,
  id: "5d676d8c-9939-4a25-bdda-1a4df8b17873",
  name: "Requerimiento Uno",
  quotedOn: null,
  requestedOn: "2026-10-01",
  status: "new",
  version: 1,
} as const;

test("lists Requirements through the same-origin API with search, Client, and status", async () => {
  let requestedUrl = "";

  const result = await listRequirements(
    {
      clientId: "  f6323093-e2fb-4875-a787-d1542064d138  ",
      page: 2,
      query: "  req-001  ",
      status: "in_analysis",
    },
    async (input, init) => {
      requestedUrl = input.toString();
      assert.deepEqual(init, { cache: "no-store" });
      return Response.json({ page: 2, pageSize: 25, requirements: [requirement], total: 26 });
    },
  );

  assert.equal(
    requestedUrl,
    "/api/requirements?page=2&query=req-001&clientId=f6323093-e2fb-4875-a787-d1542064d138&status=in_analysis",
  );
  assert.deepEqual(result, {
    data: { page: 2, pageSize: 25, requirements: [requirement], total: 26 },
    kind: "success",
  });
});

test("gets a Requirement detail through its scoped endpoint", async () => {
  const result = await getRequirement("requirement/1", async (input, init) => {
    assert.equal(input.toString(), "/api/requirements/requirement%2F1");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({ requirement });
  });

  assert.deepEqual(result, { data: requirement, kind: "success" });
});

test("creates, updates transitions, and deletes Requirements through scoped endpoints", async () => {
  const requests: Array<{ init: RequestInit | undefined; url: string }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ init, url: input.toString() });

    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    return Response.json({ requirement });
  };

  assert.deepEqual(
    await createRequirement(
      {
        clientId: "f6323093-e2fb-4875-a787-d1542064d138",
        name: "Requerimiento Uno",
        requestedOn: "2026-10-01",
      },
      fetchImplementation,
    ),
    { data: requirement, kind: "success" },
  );
  assert.deepEqual(
    await updateRequirement(
      "requirement/1",
      { quotedOn: "2026-10-02", status: "quoted", version: 1 },
      fetchImplementation,
    ),
    { data: requirement, kind: "success" },
  );
  assert.deepEqual(await deleteRequirement("requirement/1", fetchImplementation), {
    data: undefined,
    kind: "success",
  });
  assert.deepEqual(requests, [
    {
      init: {
        body: JSON.stringify({
          clientId: "f6323093-e2fb-4875-a787-d1542064d138",
          name: "Requerimiento Uno",
          requestedOn: "2026-10-01",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      url: "/api/requirements",
    },
    {
      init: {
        body: JSON.stringify({ quotedOn: "2026-10-02", status: "quoted", version: 1 }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
      url: "/api/requirements/requirement%2F1",
    },
    {
      init: { method: "DELETE" },
      url: "/api/requirements/requirement%2F1",
    },
  ]);
});

test("reads code settings and distinguishes unauthorized, validation, and conflict errors", async () => {
  const settings = await getRequirementCodeSettings(async (input, init) => {
    assert.equal(input.toString(), "/api/requirements/settings/code");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({
      settings: { codeLength: 6, nextSequence: "2", prefix: "REQ", version: 2 },
    });
  });

  assert.deepEqual(settings, {
    data: { codeLength: 6, nextSequence: "2", prefix: "REQ", version: 2 },
    kind: "success",
  });
  assert.deepEqual(
    await createRequirement(
      {
        clientId: "f6323093-e2fb-4875-a787-d1542064d138",
        name: "Requerimiento Uno",
        requestedOn: "2026-10-01",
      },
      async () => new Response(null, { status: 403 }),
    ),
    { kind: "unauthorized" },
  );
  assert.deepEqual(
    await updateRequirementCodeSettings(
      { codeLength: 6, nextSequence: "1000", prefix: "REQ", version: 1 },
      async () => Response.json({ message: "El consecutivo es inválido." }, { status: 400 }),
    ),
    { kind: "validation", message: "El consecutivo es inválido." },
  );
  assert.deepEqual(
    await updateRequirement("requirement-1", { name: "Cambio", version: 1 }, async () =>
      Response.json({ message: "Recarga el Requerimiento." }, { status: 409 }),
    ),
    { kind: "conflict", message: "Recarga el Requerimiento." },
  );
});
