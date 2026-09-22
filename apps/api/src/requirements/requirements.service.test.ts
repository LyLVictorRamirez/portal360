import assert from "node:assert/strict";
import test from "node:test";

import {
  type CreateRequirementRecordInput,
  type ListRequirementsQuery,
  type Requirement,
  type RequirementCodeSettings,
  type RequirementList,
  RequirementValidationError,
  type UpdateRequirementRecordInput,
} from "./requirements.contracts.js";
import type { RequirementStore } from "./requirements.service.js";
import { RequirementService } from "./requirements.service.js";

const timestamp = new Date("2026-09-19T00:00:00.000Z");
const requirementId = "5d676d8c-9939-4a25-bdda-1a4df8b17873";
const clientId = "f6323093-e2fb-4875-a787-d1542064d138";

function createRequirement(overrides: Partial<Requirement> = {}): Requirement {
  return {
    approvedByUserId: null,
    approvedByUserName: null,
    approvedOn: null,
    client: { code: "CLI-001", id: clientId, name: "Cliente Uno" },
    code: "REQ-001",
    committedOn: null,
    createdAt: timestamp,
    createdByUserId: "user-1",
    description: null,
    id: requirementId,
    name: "Requerimiento Uno",
    pausedFromStatus: null,
    quotedOn: null,
    requestedOn: "2026-10-01",
    status: "new",
    updatedAt: timestamp,
    updatedByUserId: "user-1",
    version: 1,
    ...overrides,
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

function createStore(overrides: Partial<RequirementStore> = {}): RequirementStore {
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
    async listRequirements(query: ListRequirementsQuery): Promise<RequirementList> {
      return { page: query.page, pageSize: query.pageSize, requirements: [], total: 0 };
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

test("creates a Requirement in new and normalizes its initial fields", async () => {
  let receivedInput: CreateRequirementRecordInput | undefined;
  const service = new RequirementService(
    createStore({
      async createRequirement(input) {
        receivedInput = input;
        return createRequirement({ status: input.status });
      },
    }),
  );

  const requirement = await service.createRequirement(
    {
      clientId,
      committedOn: "2026-10-15",
      name: "  Requerimiento Uno  ",
      requestedOn: "2026-10-01",
    },
    "user-1",
  );

  assert.equal(requirement.status, "new");
  assert.deepEqual(receivedInput, {
    actorUserId: "user-1",
    clientId,
    committedOn: "2026-10-15",
    description: null,
    name: "Requerimiento Uno",
    requestedOn: "2026-10-01",
    status: "new",
  });
});

test("rejects invalid Requirement dates and state transitions before persistence", async () => {
  let updateAttempts = 0;
  const service = new RequirementService(
    createStore({
      async updateRequirement() {
        updateAttempts += 1;
        return createRequirement();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.createRequirement(
        { clientId, committedOn: "2026-09-30", name: "Requerimiento", requestedOn: "2026-10-01" },
        "user-1",
      ),
    RequirementValidationError,
  );
  await assert.rejects(
    () => service.updateRequirement(requirementId, { status: "quoted", version: 1 }, "user-1"),
    RequirementValidationError,
  );
  await assert.doesNotReject(() =>
    service.updateRequirement(requirementId, { status: "cancelled", version: 1 }, "user-1"),
  );

  assert.equal(updateAttempts, 1);
});

test("requires approval data and records the authenticated approver on approval", async () => {
  const quotedRequirement = createRequirement({ quotedOn: "2026-10-02", status: "quoted" });
  let receivedInput: UpdateRequirementRecordInput | undefined;
  const service = new RequirementService(
    createStore({
      async getRequirement() {
        return quotedRequirement;
      },
      async updateRequirement(_id, input) {
        receivedInput = input;
        return createRequirement({
          approvedByUserId: input.approvedByUserId ?? null,
          approvedOn: input.approvedOn ?? null,
          quotedOn: quotedRequirement.quotedOn,
          status: input.status ?? quotedRequirement.status,
          version: 2,
        });
      },
    }),
  );

  await assert.rejects(
    () => service.updateRequirement(requirementId, { status: "approved", version: 1 }, "user-2"),
    RequirementValidationError,
  );

  const approved = await service.updateRequirement(
    requirementId,
    { approvedOn: "2026-10-03", status: "approved", version: 1 },
    "user-2",
  );

  assert.equal(approved.status, "approved");
  assert.deepEqual(receivedInput, {
    actorUserId: "user-2",
    approvedByUserId: "user-2",
    approvedOn: "2026-10-03",
    pausedFromStatus: null,
    status: "approved",
    version: 1,
  });
});

test("does not allow a terminal Requirement to change status", async () => {
  for (const status of ["finalized", "cancelled"] as const) {
    const service = new RequirementService(
      createStore({
        async getRequirement() {
          return createRequirement({ status });
        },
      }),
    );

    await assert.rejects(
      () =>
        service.updateRequirement(requirementId, { status: "in_analysis", version: 1 }, "user-1"),
      RequirementValidationError,
    );
  }
});

test("pauses, resumes, and cancels a Requirement while preserving its workflow state", async () => {
  const executingRequirement = createRequirement({
    approvedByUserId: "user-1",
    approvedOn: "2026-10-03",
    quotedOn: "2026-10-02",
    status: "in_execution",
  });
  let pausedInput: UpdateRequirementRecordInput | undefined;
  const pauseService = new RequirementService(
    createStore({
      async getRequirement() {
        return executingRequirement;
      },
      async updateRequirement(_id, input) {
        pausedInput = input;
        return createRequirement({
          ...executingRequirement,
          pausedFromStatus: input.pausedFromStatus,
          status: input.status ?? executingRequirement.status,
        });
      },
    }),
  );

  const paused = await pauseService.updateRequirement(
    requirementId,
    { status: "paused", version: 1 },
    "user-2",
  );

  assert.equal(paused.status, "paused");
  assert.equal(paused.pausedFromStatus, "in_execution");
  assert.deepEqual(pausedInput, {
    actorUserId: "user-2",
    approvedByUserId: undefined,
    pausedFromStatus: "in_execution",
    status: "paused",
    version: 1,
  });

  let resumedInput: UpdateRequirementRecordInput | undefined;
  const resumeService = new RequirementService(
    createStore({
      async getRequirement() {
        return paused;
      },
      async updateRequirement(_id, input) {
        resumedInput = input;
        return createRequirement({
          ...paused,
          pausedFromStatus: input.pausedFromStatus,
          status: input.status ?? paused.status,
        });
      },
    }),
  );

  const resumed = await resumeService.updateRequirement(
    requirementId,
    { status: "in_execution", version: 2 },
    "user-2",
  );

  assert.equal(resumed.status, "in_execution");
  assert.equal(resumed.pausedFromStatus, null);
  assert.deepEqual(resumedInput, {
    actorUserId: "user-2",
    approvedByUserId: undefined,
    pausedFromStatus: null,
    status: "in_execution",
    version: 2,
  });

  const cancelService = new RequirementService(
    createStore({
      async getRequirement() {
        return paused;
      },
    }),
  );

  await assert.doesNotReject(() =>
    cancelService.updateRequirement(requirementId, { status: "cancelled", version: 2 }, "user-2"),
  );
});

test("rejects a paused Requirement transition other than its saved state or cancellation", async () => {
  const service = new RequirementService(
    createStore({
      async getRequirement() {
        return createRequirement({
          pausedFromStatus: "quoted",
          quotedOn: "2026-10-02",
          status: "paused",
        });
      },
    }),
  );

  await assert.rejects(
    () => service.updateRequirement(requirementId, { status: "approved", version: 1 }, "user-1"),
    RequirementValidationError,
  );
});

test("lists 25 Requirements per page with Client and status filters", async () => {
  let receivedQuery: ListRequirementsQuery | undefined;
  const service = new RequirementService(
    createStore({
      async listRequirements(query) {
        receivedQuery = query;
        return { page: query.page, pageSize: query.pageSize, requirements: [], total: 0 };
      },
    }),
  );

  const result = await service.listRequirements({
    clientId,
    page: 2,
    query: "  REQ-001  ",
    status: "in_analysis",
  });

  assert.deepEqual(receivedQuery, {
    clientId,
    page: 2,
    pageSize: 25,
    query: "REQ-001",
    status: "in_analysis",
  });
  assert.deepEqual(result, { page: 2, pageSize: 25, requirements: [], total: 0 });
});

test("rejects an invalid Requirement code configuration before reaching storage", async () => {
  let updateAttempts = 0;
  const service = new RequirementService(
    createStore({
      async updateCodeSettings(): Promise<RequirementCodeSettings> {
        updateAttempts += 1;
        return createCodeSettings();
      },
    }),
  );

  await assert.rejects(
    () =>
      service.updateCodeSettings(
        { codeLength: 6, nextSequence: 1000n, prefix: "REQ", version: 1 },
        "user-1",
      ),
    RequirementValidationError,
  );

  assert.equal(updateAttempts, 0);
});
