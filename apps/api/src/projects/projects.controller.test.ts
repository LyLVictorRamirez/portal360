import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";

import {
  type CreateProjectInput,
  type ListProjectsInput,
  type Project,
  type ProjectCodeSettings,
  type ProjectList,
  ProjectNotFoundError,
  ProjectRelatedRecordsError,
  ProjectTerminalStatusError,
  ProjectVersionConflictError,
} from "./projects.contracts.js";
import { ProjectsController, type ProjectsControllerStore } from "./projects.controller.js";
import { requiredPermissionsMetadataKey } from "../authorization/require-permissions.decorator.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");
const requestContext = { authorization: { permissions: [], roles: [] }, userId: "user-1" };

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

function createStore(overrides: Partial<ProjectsControllerStore> = {}): ProjectsControllerStore {
  return {
    async createProject(): Promise<Project> {
      return createProject();
    },
    async deleteProject(): Promise<void> {},
    async getCodeSettings(): Promise<ProjectCodeSettings> {
      return createCodeSettings();
    },
    async getProject(): Promise<Project> {
      return createProject();
    },
    async listProjects(): Promise<ProjectList> {
      return { page: 1, pageSize: 25, projects: [createProject()], total: 1 };
    },
    async updateCodeSettings(): Promise<ProjectCodeSettings> {
      return createCodeSettings();
    },
    async updateProject(): Promise<Project> {
      return createProject();
    },
    ...overrides,
  };
}

test("declares the Project permission boundary for every route", () => {
  for (const [route, permissions] of [
    [ProjectsController.prototype.listProjects, ["projects.read"]],
    [ProjectsController.prototype.createProject, ["projects.manage"]],
    [ProjectsController.prototype.getCodeSettings, ["projects.settings.manage"]],
    [ProjectsController.prototype.updateCodeSettings, ["projects.settings.manage"]],
    [ProjectsController.prototype.getProject, ["projects.read"]],
    [ProjectsController.prototype.updateProject, ["projects.manage"]],
    [ProjectsController.prototype.deleteProject, ["projects.manage"]],
  ]) {
    assert.deepEqual(Reflect.getMetadata(requiredPermissionsMetadataKey, route), permissions);
  }
});

test("lists Projects with the requested pagination, search, Client, and status", async () => {
  let receivedInput: ListProjectsInput | undefined;
  const controller = new ProjectsController(
    createStore({
      async listProjects(input) {
        receivedInput = input;
        return { page: 2, pageSize: 25, projects: [createProject()], total: 26 };
      },
    }),
  );

  const response = await controller.listProjects(
    "2",
    "PRY",
    "f6323093-e2fb-4875-a787-d1542064d138",
    "in_execution",
  );

  assert.deepEqual(receivedInput, {
    clientId: "f6323093-e2fb-4875-a787-d1542064d138",
    page: 2,
    query: "PRY",
    status: "in_execution",
  });
  assert.deepEqual(response, {
    page: 2,
    pageSize: 25,
    projects: [
      {
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
      },
    ],
    total: 26,
  });
});

test("creates a Project and serializes its code settings consecutive", async () => {
  let receivedProjectInput: CreateProjectInput | undefined;
  let receivedActorUserId: string | undefined;
  const controller = new ProjectsController(
    createStore({
      async createProject(input, actorUserId) {
        receivedProjectInput = input;
        receivedActorUserId = actorUserId;
        return createProject();
      },
    }),
  );

  const response = await controller.createProject(
    {
      clientId: "f6323093-e2fb-4875-a787-d1542064d138",
      committedEndDate: "2026-10-31",
      name: "Proyecto Uno",
      startDate: "2026-10-01",
    },
    requestContext,
  );
  const settings = await controller.updateCodeSettings(
    { codeLength: 7, nextSequence: "10", prefix: "PRY", version: 1 },
    requestContext,
  );

  assert.deepEqual(receivedProjectInput, {
    clientId: "f6323093-e2fb-4875-a787-d1542064d138",
    committedEndDate: "2026-10-31",
    description: undefined,
    name: "Proyecto Uno",
    startDate: "2026-10-01",
    status: undefined,
  });
  assert.equal(receivedActorUserId, "user-1");
  assert.equal(response.project.code, "PRY-001");
  assert.deepEqual(settings, {
    settings: { codeLength: 6, nextSequence: "2", prefix: "PRY", version: 2 },
  });
});

test("maps a stale Project update to HTTP 409", async () => {
  const controller = new ProjectsController(
    createStore({
      async updateProject() {
        throw new ProjectVersionConflictError("Reload the Project.");
      },
    }),
  );

  await assert.rejects(
    () =>
      controller.updateProject(
        "5d676d8c-9939-4a25-bdda-1a4df8b17873",
        { status: "in_execution", version: 1 },
        requestContext,
      ),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});

test("rejects replaced Project statuses at the HTTP boundary", async () => {
  const controller = new ProjectsController(createStore());

  await assert.rejects(
    () => controller.listProjects(undefined, undefined, undefined, "active"),
    (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
  );
  await assert.rejects(
    () =>
      controller.createProject(
        {
          clientId: "f6323093-e2fb-4875-a787-d1542064d138",
          committedEndDate: "2026-10-31",
          name: "Proyecto Uno",
          startDate: "2026-10-01",
          status: "planned",
        },
        requestContext,
      ),
    (error: unknown) => error instanceof BadRequestException && error.getStatus() === 400,
  );
});

test("maps terminal Project updates to HTTP 409", async () => {
  const controller = new ProjectsController(
    createStore({
      async updateProject() {
        throw new ProjectTerminalStatusError("The Project is finalized.");
      },
    }),
  );

  await assert.rejects(
    () =>
      controller.updateProject(
        "5d676d8c-9939-4a25-bdda-1a4df8b17873",
        { status: "paused", version: 1 },
        requestContext,
      ),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});

test("maps a missing Project to HTTP 404", async () => {
  const controller = new ProjectsController(
    createStore({
      async getProject() {
        throw new ProjectNotFoundError("Project not found.");
      },
    }),
  );

  await assert.rejects(
    () => controller.getProject("5d676d8c-9939-4a25-bdda-1a4df8b17873"),
    (error: unknown) => error instanceof NotFoundException && error.getStatus() === 404,
  );
});

test("maps deletion blocked by Project relations to HTTP 409", async () => {
  const controller = new ProjectsController(
    createStore({
      async deleteProject() {
        throw new ProjectRelatedRecordsError("Remove related records first.");
      },
    }),
  );

  await assert.rejects(
    () => controller.deleteProject("5d676d8c-9939-4a25-bdda-1a4df8b17873"),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});
