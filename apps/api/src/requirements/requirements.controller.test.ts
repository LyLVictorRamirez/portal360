import assert from "node:assert/strict";
import test from "node:test";

import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  type CreateRequirementInput,
  type ListRequirementsInput,
  type Requirement,
  type RequirementCodeSettings,
  type RequirementList,
  RequirementNotFoundError,
  RequirementRelatedRecordsError,
  RequirementVersionConflictError,
} from "./requirements.contracts.js";
import {
  RequirementsController,
  type RequirementsControllerStore,
} from "./requirements.controller.js";
import { requiredPermissionsMetadataKey } from "../authorization/require-permissions.decorator.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");
const clientId = "f6323093-e2fb-4875-a787-d1542064d138";
const requirementId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";
const requestContext = { authorization: { permissions: [], roles: [] }, userId: "user-1" };

function createRequirement(): Requirement {
  return {
    approvedByUserId: null,
    approvedOn: null,
    client: { code: "CLI-001", id: clientId, name: "Cliente Uno" },
    code: "REQ-001",
    committedOn: null,
    createdAt: timestamp,
    createdByUserId: "user-1",
    description: null,
    id: requirementId,
    name: "Requerimiento Uno",
    quotedOn: null,
    requestedOn: "2026-10-01",
    status: "new",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
  };
}

function createCodeSettings(): RequirementCodeSettings {
  return {
    codeLength: 6,
    createdAt: timestamp,
    createdByUserId: null,
    nextSequence: 2n,
    prefix: "REQ",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 2,
  };
}

function createStore(
  overrides: Partial<RequirementsControllerStore> = {},
): RequirementsControllerStore {
  return {
    async createRequirement(): Promise<Requirement> {
      return createRequirement();
    },
    async deleteRequirement(): Promise<void> {},
    async getCodeSettings(): Promise<RequirementCodeSettings> {
      return createCodeSettings();
    },
    async getRequirement(): Promise<Requirement> {
      return createRequirement();
    },
    async listRequirements(): Promise<RequirementList> {
      return { page: 1, pageSize: 25, requirements: [createRequirement()], total: 1 };
    },
    async updateCodeSettings(): Promise<RequirementCodeSettings> {
      return createCodeSettings();
    },
    async updateRequirement(): Promise<Requirement> {
      return createRequirement();
    },
    ...overrides,
  };
}

test("declares the Requirement permission boundary for every route", () => {
  for (const [route, permissions] of [
    [RequirementsController.prototype.listRequirements, ["requirements.read"]],
    [RequirementsController.prototype.createRequirement, ["requirements.manage"]],
    [RequirementsController.prototype.getCodeSettings, ["requirements.settings.manage"]],
    [RequirementsController.prototype.updateCodeSettings, ["requirements.settings.manage"]],
    [RequirementsController.prototype.getRequirement, ["requirements.read"]],
    [RequirementsController.prototype.updateRequirement, ["requirements.manage"]],
    [RequirementsController.prototype.deleteRequirement, ["requirements.manage"]],
  ]) {
    assert.deepEqual(Reflect.getMetadata(requiredPermissionsMetadataKey, route), permissions);
  }
});

test("lists Requirements with pagination, search, Client, and status", async () => {
  let receivedInput: ListRequirementsInput | undefined;
  const controller = new RequirementsController(
    createStore({
      async listRequirements(input) {
        receivedInput = input;
        return { page: 2, pageSize: 25, requirements: [createRequirement()], total: 26 };
      },
    }),
  );

  const response = await controller.listRequirements("2", "REQ", clientId, "in_analysis");

  assert.deepEqual(receivedInput, { clientId, page: 2, query: "REQ", status: "in_analysis" });
  assert.deepEqual(response, {
    page: 2,
    pageSize: 25,
    requirements: [
      {
        approvedByUserId: null,
        approvedOn: null,
        client: { code: "CLI-001", id: clientId, name: "Cliente Uno" },
        code: "REQ-001",
        committedOn: null,
        description: null,
        id: requirementId,
        name: "Requerimiento Uno",
        quotedOn: null,
        requestedOn: "2026-10-01",
        status: "new",
        version: 1,
      },
    ],
    total: 26,
  });
});

test("creates a Requirement and serializes its code settings consecutive", async () => {
  let receivedInput: CreateRequirementInput | undefined;
  let receivedActorUserId: string | undefined;
  const controller = new RequirementsController(
    createStore({
      async createRequirement(input, actorUserId) {
        receivedInput = input;
        receivedActorUserId = actorUserId;
        return createRequirement();
      },
    }),
  );

  const response = await controller.createRequirement(
    { clientId, name: "Requerimiento Uno", requestedOn: "2026-10-01" },
    requestContext,
  );
  const settings = await controller.updateCodeSettings(
    { codeLength: 7, nextSequence: "10", prefix: "REQ", version: 1 },
    requestContext,
  );

  assert.deepEqual(receivedInput, {
    clientId,
    committedOn: undefined,
    description: undefined,
    name: "Requerimiento Uno",
    requestedOn: "2026-10-01",
  });
  assert.equal(receivedActorUserId, "user-1");
  assert.equal(response.requirement.code, "REQ-001");
  assert.deepEqual(settings, {
    settings: { codeLength: 6, nextSequence: "2", prefix: "REQ", version: 2 },
  });
});

test("maps Requirement conflicts, missing records, and relation restrictions", async () => {
  const staleController = new RequirementsController(
    createStore({
      async updateRequirement() {
        throw new RequirementVersionConflictError("Reload the Requirement.");
      },
    }),
  );
  const missingController = new RequirementsController(
    createStore({
      async getRequirement() {
        throw new RequirementNotFoundError("Requirement not found.");
      },
    }),
  );
  const relatedController = new RequirementsController(
    createStore({
      async deleteRequirement() {
        throw new RequirementRelatedRecordsError("Remove related records first.");
      },
    }),
  );

  await assert.rejects(
    () =>
      staleController.updateRequirement(
        requirementId,
        { name: "Cambio", version: 1 },
        requestContext,
      ),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
  await assert.rejects(
    () => missingController.getRequirement(requirementId),
    (error: unknown) => error instanceof NotFoundException && error.getStatus() === 404,
  );
  await assert.rejects(
    () => relatedController.deleteRequirement(requirementId),
    (error: unknown) => error instanceof ConflictException && error.getStatus() === 409,
  );
});
