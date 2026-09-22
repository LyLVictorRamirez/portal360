import assert from "node:assert/strict";
import test from "node:test";

import {
  createProject,
  deleteProject,
  getProject,
  getProjectCodeSettings,
  listProjects,
  updateProject,
  updateProjectCodeSettings,
} from "./projects-client.ts";

const project = {
  client: {
    code: "CLI-001",
    id: "f6323093-e2fb-4875-a787-d1542064d138",
    name: "Cliente Uno",
  },
  code: "PRY-001",
  committedEndDate: "2026-10-31",
  description: null,
  id: "5d676d8c-9939-4a25-bdda-1a4df8b17873",
  name: "Proyecto Uno",
  startDate: "2026-10-01",
  status: "new",
  version: 1,
} as const;

test("lists Projects through the same-origin API with search, Client, and status", async () => {
  let requestedUrl = "";

  const result = await listProjects(
    {
      clientId: "  f6323093-e2fb-4875-a787-d1542064d138  ",
      page: 2,
      query: "  pry-001  ",
      status: "in_execution",
    },
    async (input, init) => {
      requestedUrl = input.toString();
      assert.deepEqual(init, { cache: "no-store" });
      return Response.json({ page: 2, pageSize: 25, projects: [project], total: 26 });
    },
  );

  assert.equal(
    requestedUrl,
    "/api/projects?page=2&query=pry-001&clientId=f6323093-e2fb-4875-a787-d1542064d138&status=in_execution",
  );
  assert.deepEqual(result, {
    data: { page: 2, pageSize: 25, projects: [project], total: 26 },
    kind: "success",
  });
});

test("gets a Project detail through its scoped endpoint", async () => {
  const result = await getProject("project/1", async (input, init) => {
    assert.equal(input.toString(), "/api/projects/project%2F1");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({ project });
  });

  assert.deepEqual(result, { data: project, kind: "success" });
});

test("creates, updates, and deletes Projects through scoped endpoints", async () => {
  const requests: Array<{ init: RequestInit | undefined; url: string }> = [];
  const fetchImplementation: typeof fetch = async (input, init) => {
    requests.push({ init, url: input.toString() });

    if (init?.method === "DELETE") {
      return new Response(null, { status: 204 });
    }

    return Response.json({ project });
  };

  assert.deepEqual(
    await createProject(
      {
        clientId: "f6323093-e2fb-4875-a787-d1542064d138",
        committedEndDate: "2026-10-31",
        name: "Proyecto Uno",
        startDate: "2026-10-01",
        status: "new",
      },
      fetchImplementation,
    ),
    { data: project, kind: "success" },
  );
  assert.deepEqual(
    await updateProject(
      "project/1",
      { description: null, status: "in_execution", version: 1 },
      fetchImplementation,
    ),
    { data: project, kind: "success" },
  );
  assert.deepEqual(await deleteProject("project/1", fetchImplementation), {
    data: undefined,
    kind: "success",
  });
  assert.deepEqual(requests, [
    {
      init: {
        body: JSON.stringify({
          clientId: "f6323093-e2fb-4875-a787-d1542064d138",
          committedEndDate: "2026-10-31",
          name: "Proyecto Uno",
          startDate: "2026-10-01",
          status: "new",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      },
      url: "/api/projects",
    },
    {
      init: {
        body: JSON.stringify({ description: null, status: "in_execution", version: 1 }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      },
      url: "/api/projects/project%2F1",
    },
    {
      init: { method: "DELETE" },
      url: "/api/projects/project%2F1",
    },
  ]);
});

test("reads code settings and distinguishes unauthorized, validation, and conflict errors", async () => {
  const settings = await getProjectCodeSettings(async (input, init) => {
    assert.equal(input.toString(), "/api/projects/settings/code");
    assert.deepEqual(init, { cache: "no-store" });
    return Response.json({
      settings: { codeLength: 6, nextSequence: "2", prefix: "PRY", version: 2 },
    });
  });

  assert.deepEqual(settings, {
    data: { codeLength: 6, nextSequence: "2", prefix: "PRY", version: 2 },
    kind: "success",
  });
  assert.deepEqual(
    await createProject(
      {
        clientId: "f6323093-e2fb-4875-a787-d1542064d138",
        committedEndDate: "2026-10-31",
        name: "Proyecto Uno",
        startDate: "2026-10-01",
      },
      async () => new Response(null, { status: 403 }),
    ),
    { kind: "unauthorized" },
  );
  assert.deepEqual(
    await updateProjectCodeSettings(
      { codeLength: 6, nextSequence: "1000", prefix: "PRY", version: 1 },
      async () => Response.json({ message: "El consecutivo es inválido." }, { status: 400 }),
    ),
    { kind: "validation", message: "El consecutivo es inválido." },
  );
  assert.deepEqual(
    await updateProject("project-1", { name: "Proyecto Dos", version: 1 }, async () =>
      Response.json({ message: "Recarga el Proyecto." }, { status: 409 }),
    ),
    { kind: "conflict", message: "Recarga el Proyecto." },
  );
});
