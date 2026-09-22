import assert from "node:assert/strict";
import test from "node:test";

import {
  type CreateProjectRecordInput,
  type CreateProjectStageRecordInput,
  type ListProjectsQuery,
  type Project,
  type ProjectCodeSettings,
  type ProjectList,
  type ProjectStage,
  ProjectTerminalStatusError,
  ProjectStageValidationError,
  ProjectValidationError,
  type UpdateProjectRecordInput,
} from "./projects.contracts.js";
import type { ProjectStore } from "./projects.service.js";
import { ProjectService } from "./projects.service.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");

function createProject(): Project {
  return {
    client: {
      code: "CLI-001",
      id: "f6323093-e2fb-4875-a787-d1542064d138",
      name: "Cliente Uno",
    },
    code: "PRY-001",
    committedEndDate: "2026-10-31",
    createdAt: timestamp,
    createdByUserId: "user-1",
    description: null,
    id: "5d676d8c-9939-4a25-bdda-1a4df8b17873",
    name: "Proyecto Uno",
    startDate: "2026-10-01",
    status: "new",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
  };
}

function createCodeSettings(): ProjectCodeSettings {
  return {
    codeLength: 6,
    createdAt: timestamp,
    createdByUserId: null,
    nextSequence: 2n,
    prefix: "PRY",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 2,
  };
}

function createProjectStage(): ProjectStage {
  return {
    createdAt: timestamp,
    createdByUserId: "user-1",
    id: "4f9b1c2d-3513-4cc1-a266-c53589bbab77",
    name: "Diseño",
    position: 1,
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
  };
}

function createStore(overrides: Partial<ProjectStore> = {}): ProjectStore {
  return {
    async createProject(): Promise<Project> {
      return createProject();
    },
    async createProjectStage(): Promise<ProjectStage> {
      return createProjectStage();
    },
    async deleteProject(): Promise<void> {},
    async deleteProjectStage(): Promise<void> {},
    async getCodeSettings(): Promise<ProjectCodeSettings> {
      return createCodeSettings();
    },
    async getProject(): Promise<Project> {
      return createProject();
    },
    async listProjects(query: ListProjectsQuery): Promise<ProjectList> {
      return { page: query.page, pageSize: query.pageSize, projects: [], total: 0 };
    },
    async moveProjectStage(): Promise<ProjectStage> {
      return createProjectStage();
    },
    async updateCodeSettings(): Promise<ProjectCodeSettings> {
      return createCodeSettings();
    },
    async updateProject(): Promise<Project> {
      return createProject();
    },
    async updateProjectStage(): Promise<ProjectStage> {
      return createProjectStage();
    },
    ...overrides,
  };
}

test("defaults a new Project to new while allowing a selected initial status", async () => {
  const inputs: CreateProjectRecordInput[] = [];
  const service = new ProjectService(
    createStore({
      async createProject(input) {
        inputs.push(input);
        return { ...createProject(), status: input.status };
      },
    }),
  );

  const defaultProject = await service.createProject(
    {
      clientId: "f6323093-e2fb-4875-a787-d1542064d138",
      committedEndDate: "2026-10-31",
      name: "  Proyecto Uno  ",
      startDate: "2026-10-01",
    },
    "user-1",
  );
  const inExecutionProject = await service.createProject(
    {
      clientId: "f6323093-e2fb-4875-a787-d1542064d138",
      committedEndDate: "2026-10-31",
      name: "Proyecto Dos",
      startDate: "2026-10-01",
      status: "in_execution",
    },
    "user-1",
  );

  assert.equal(defaultProject.status, "new");
  assert.equal(inExecutionProject.status, "in_execution");
  assert.deepEqual(inputs[0], {
    actorUserId: "user-1",
    clientId: "f6323093-e2fb-4875-a787-d1542064d138",
    committedEndDate: "2026-10-31",
    description: undefined,
    name: "Proyecto Uno",
    startDate: "2026-10-01",
    status: "new",
  });
});

test("rejects invalid Project dates and statuses before reaching storage", async () => {
  let createAttempts = 0;
  const service = new ProjectService(
    createStore({
      async createProject() {
        createAttempts += 1;
        return createProject();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.createProject(
        {
          clientId: "f6323093-e2fb-4875-a787-d1542064d138",
          committedEndDate: "2026-09-30",
          name: "Proyecto Uno",
          startDate: "2026-10-01",
        },
        "user-1",
      ),
    ProjectValidationError,
  );
  await assert.rejects(
    () =>
      service.createProject(
        {
          clientId: "f6323093-e2fb-4875-a787-d1542064d138",
          committedEndDate: "2026-10-31",
          name: "Proyecto Uno",
          startDate: "2026-10-01",
          status: "unknown" as "new",
        },
        "user-1",
      ),
    ProjectValidationError,
  );
  await assert.rejects(
    () =>
      service.updateProject(
        "5d676d8c-9939-4a25-bdda-1a4df8b17873",
        { committedEndDate: "2026-09-30", startDate: "2026-10-01", version: 1 },
        "user-1",
      ),
    ProjectValidationError,
  );

  assert.equal(createAttempts, 0);
});

test("normalizes a Project Stage name and validates its input before reaching storage", async () => {
  let receivedInput: CreateProjectStageRecordInput | undefined;
  let createAttempts = 0;
  const service = new ProjectService(
    createStore({
      async createProjectStage(_projectId, input) {
        createAttempts += 1;
        receivedInput = input;
        return { ...createProjectStage(), name: input.name };
      },
    }),
  );

  const stage = await service.createProjectStage(
    "5d676d8c-9939-4a25-bdda-1a4df8b17873",
    { name: "  Diseño  " },
    "user-2",
  );

  assert.equal(stage.name, "Diseño");
  assert.deepEqual(receivedInput, { actorUserId: "user-2", name: "Diseño" });
  await assert.rejects(
    () =>
      service.createProjectStage(
        "5d676d8c-9939-4a25-bdda-1a4df8b17873",
        { name: "0123456789abcdef" },
        "user-2",
      ),
    ProjectStageValidationError,
  );
  assert.equal(createAttempts, 1);
});

test("rejects Project Stage changes for terminal Projects before reaching storage", async () => {
  let updateAttempts = 0;
  const service = new ProjectService(
    createStore({
      async getProject() {
        return { ...createProject(), status: "finalized" as const };
      },
      async updateProjectStage() {
        updateAttempts += 1;
        return createProjectStage();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.updateProjectStage(
        "5d676d8c-9939-4a25-bdda-1a4df8b17873",
        "4f9b1c2d-3513-4cc1-a266-c53589bbab77",
        { name: "Construcción", version: 1 },
        "user-1",
      ),
    ProjectTerminalStatusError,
  );
  assert.equal(updateAttempts, 0);
});

test("lists 25 Projects per page with Client and status filters", async () => {
  let receivedQuery: ListProjectsQuery | undefined;
  const service = new ProjectService(
    createStore({
      async listProjects(query) {
        receivedQuery = query;
        return { page: query.page, pageSize: query.pageSize, projects: [], total: 0 };
      },
    }),
  );

  const result = await service.listProjects({
    clientId: "f6323093-e2fb-4875-a787-d1542064d138",
    page: 2,
    query: "  PRY-001  ",
    status: "paused",
  });

  assert.deepEqual(receivedQuery, {
    clientId: "f6323093-e2fb-4875-a787-d1542064d138",
    page: 2,
    pageSize: 25,
    query: "PRY-001",
    status: "paused",
  });
  assert.deepEqual(result, { page: 2, pageSize: 25, projects: [], total: 0 });
});

test("normalizes a Project update and allows clearing its optional description", async () => {
  let receivedProjectId: string | undefined;
  let receivedInput: UpdateProjectRecordInput | undefined;
  const service = new ProjectService(
    createStore({
      async updateProject(projectId, input) {
        receivedProjectId = projectId;
        receivedInput = input;
        return {
          ...createProject(),
          description: input.description ?? null,
          version: input.version + 1,
        };
      },
    }),
  );

  const project = await service.updateProject(
    "5d676d8c-9939-4a25-bdda-1a4df8b17873",
    { description: null, status: "in_execution", version: 1 },
    "user-2",
  );

  assert.equal(receivedProjectId, "5d676d8c-9939-4a25-bdda-1a4df8b17873");
  assert.deepEqual(receivedInput, {
    actorUserId: "user-2",
    description: null,
    status: "in_execution",
    version: 1,
  });
  assert.equal(project.version, 2);
});

test("rejects updates to finalized and cancelled Projects before reaching storage", async () => {
  for (const status of ["finalized", "cancelled"] as const) {
    let updateAttempts = 0;
    const service = new ProjectService(
      createStore({
        async getProject() {
          return { ...createProject(), status };
        },
        async updateProject() {
          updateAttempts += 1;
          return createProject();
        },
      }),
    );

    await assert.rejects(
      () =>
        service.updateProject(
          "5d676d8c-9939-4a25-bdda-1a4df8b17873",
          { name: "Proyecto actualizado", version: 1 },
          "user-1",
        ),
      ProjectTerminalStatusError,
    );
    assert.equal(updateAttempts, 0);
  }
});

test("rejects an invalid Project code configuration before reaching storage", async () => {
  let updateAttempts = 0;
  const service = new ProjectService(
    createStore({
      async updateCodeSettings(): Promise<ProjectCodeSettings> {
        updateAttempts += 1;
        return createCodeSettings();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.updateCodeSettings(
        { codeLength: 6, nextSequence: 1000n, prefix: "PRY", version: 1 },
        "user-1",
      ),
    ProjectValidationError,
  );

  assert.equal(updateAttempts, 0);
});
