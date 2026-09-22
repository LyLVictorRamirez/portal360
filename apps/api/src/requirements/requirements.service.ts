import { Inject, Injectable } from "@nestjs/common";

import {
  type CreateRequirementInput,
  type CreateRequirementRecordInput,
  type ListRequirementsInput,
  type ListRequirementsQuery,
  type Requirement,
  type RequirementCodeSettings,
  type RequirementList,
  type RequirementPausableStatus,
  type RequirementStatus,
  requirementStatuses,
  RequirementValidationError,
  type UpdateRequirementCodeSettingsInput,
  type UpdateRequirementCodeSettingsRecordInput,
  type UpdateRequirementInput,
  type UpdateRequirementRecordInput,
} from "./requirements.contracts.js";
import { RequirementRepository } from "./requirements.repository.js";

const requirementListPageSize = 25;

export interface RequirementStore {
  createRequirement(input: CreateRequirementRecordInput): Promise<Requirement>;
  deleteRequirement(requirementId: string): Promise<void>;
  getCodeSettings(): Promise<RequirementCodeSettings>;
  getRequirement(requirementId: string): Promise<Requirement>;
  listRequirements(query: ListRequirementsQuery): Promise<RequirementList>;
  updateCodeSettings(
    input: UpdateRequirementCodeSettingsRecordInput,
  ): Promise<RequirementCodeSettings>;
  updateRequirement(
    requirementId: string,
    input: UpdateRequirementRecordInput,
  ): Promise<Requirement>;
}

@Injectable()
export class RequirementService {
  constructor(
    @Inject(RequirementRepository) private readonly requirementRepository: RequirementStore,
  ) {}

  async getCodeSettings(): Promise<RequirementCodeSettings> {
    return this.requirementRepository.getCodeSettings();
  }

  async createRequirement(
    input: CreateRequirementInput,
    actorUserId: string,
  ): Promise<Requirement> {
    return this.requirementRepository.createRequirement({
      ...normalizeRequirementCreation(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async getRequirement(requirementId: string): Promise<Requirement> {
    return this.requirementRepository.getRequirement(normalizeRequirementId(requirementId));
  }

  async listRequirements(input: ListRequirementsInput = {}): Promise<RequirementList> {
    const page = input.page ?? 1;

    if (!Number.isSafeInteger(page) || page < 1) {
      throw new RequirementValidationError("Requirement list page must be a positive integer.");
    }

    const status = input.status ?? "all";

    return this.requirementRepository.listRequirements({
      clientId: input.clientId === undefined ? null : normalizeRequirementClientId(input.clientId),
      page,
      pageSize: requirementListPageSize,
      query: normalizeSearchQuery(input.query),
      status: status === "all" ? null : normalizeRequirementStatus(status),
    });
  }

  async updateRequirement(
    requirementId: string,
    input: UpdateRequirementInput,
    actorUserId: string,
  ): Promise<Requirement> {
    const normalizedRequirementId = normalizeRequirementId(requirementId);
    const actorId = normalizeActorUserId(actorUserId);
    const update = normalizeRequirementUpdate(input);
    const current = await this.requirementRepository.getRequirement(normalizedRequirementId);
    const status = update.status ?? current.status;

    validateRequirementTransition(current, status);
    const pausedFromStatus = resolvePausedFromStatus(current, status);

    const approvedByUserId =
      current.approvedByUserId === null && current.status === "quoted" && status === "approved"
        ? actorId
        : undefined;
    const candidate = {
      approvedByUserId: approvedByUserId ?? current.approvedByUserId,
      approvedOn: update.approvedOn === undefined ? current.approvedOn : update.approvedOn,
      committedOn: update.committedOn === undefined ? current.committedOn : update.committedOn,
      quotedOn: update.quotedOn === undefined ? current.quotedOn : update.quotedOn,
      requestedOn: update.requestedOn ?? current.requestedOn,
      pausedFromStatus,
      status,
    };

    validateRequirementDates(candidate);

    return this.requirementRepository.updateRequirement(normalizedRequirementId, {
      ...update,
      actorUserId: actorId,
      approvedByUserId,
      pausedFromStatus,
    });
  }

  async deleteRequirement(requirementId: string): Promise<void> {
    await this.requirementRepository.deleteRequirement(normalizeRequirementId(requirementId));
  }

  async updateCodeSettings(
    input: UpdateRequirementCodeSettingsInput,
    actorUserId: string,
  ): Promise<RequirementCodeSettings> {
    return this.requirementRepository.updateCodeSettings({
      ...normalizeCodeSettingsUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }
}

function normalizeRequirementCreation(
  value: CreateRequirementInput,
): Omit<CreateRequirementRecordInput, "actorUserId"> {
  if (typeof value !== "object" || value === null) {
    throw new RequirementValidationError("Requirement creation must be an object.");
  }

  const requestedOn = normalizeDate(value.requestedOn, "Requirement requested date");
  const committedOn =
    normalizeOptionalDate(value.committedOn, "Requirement committed date") ?? null;
  validateRequirementDates({
    approvedByUserId: null,
    approvedOn: null,
    committedOn,
    quotedOn: null,
    requestedOn,
    pausedFromStatus: null,
    status: "new",
  });

  return {
    clientId: normalizeRequirementClientId(value.clientId),
    committedOn,
    description: normalizeDescription(value.description) ?? null,
    name: normalizeRequirementName(value.name),
    requestedOn,
    status: "new",
  };
}

function normalizeRequirementUpdate(value: UpdateRequirementInput): UpdateRequirementInput {
  if (typeof value !== "object" || value === null) {
    throw new RequirementValidationError("Requirement update must be an object.");
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new RequirementValidationError("Requirement version must be a positive integer.");
  }

  const name = value.name === undefined ? undefined : normalizeRequirementName(value.name);
  const description =
    value.description === undefined ? undefined : normalizeDescription(value.description);
  const requestedOn =
    value.requestedOn === undefined
      ? undefined
      : normalizeDate(value.requestedOn, "Requirement requested date");
  const committedOn =
    value.committedOn === undefined
      ? undefined
      : normalizeOptionalDate(value.committedOn, "Requirement committed date");
  const quotedOn =
    value.quotedOn === undefined
      ? undefined
      : normalizeOptionalDate(value.quotedOn, "Requirement quoted date");
  const approvedOn =
    value.approvedOn === undefined
      ? undefined
      : normalizeOptionalDate(value.approvedOn, "Requirement approval date");
  const status = value.status === undefined ? undefined : normalizeRequirementStatus(value.status);

  if (
    name === undefined &&
    description === undefined &&
    requestedOn === undefined &&
    committedOn === undefined &&
    quotedOn === undefined &&
    approvedOn === undefined &&
    status === undefined
  ) {
    throw new RequirementValidationError(
      "A Requirement update must change its details, dates, or status.",
    );
  }

  const update: UpdateRequirementInput = { version: value.version };

  if (name !== undefined) {
    update.name = name;
  }

  if (value.description !== undefined) {
    update.description = description;
  }

  if (requestedOn !== undefined) {
    update.requestedOn = requestedOn;
  }

  if (committedOn !== undefined) {
    update.committedOn = committedOn;
  }

  if (quotedOn !== undefined) {
    update.quotedOn = quotedOn;
  }

  if (approvedOn !== undefined) {
    update.approvedOn = approvedOn;
  }

  if (status !== undefined) {
    update.status = status;
  }

  return update;
}

function normalizeCodeSettingsUpdate(
  value: UpdateRequirementCodeSettingsInput,
): UpdateRequirementCodeSettingsInput {
  if (typeof value !== "object" || value === null) {
    throw new RequirementValidationError("Requirement code settings update must be an object.");
  }

  if (typeof value.prefix !== "string" || !/^[A-Z0-9]{1,10}$/.test(value.prefix)) {
    throw new RequirementValidationError(
      "Requirement code prefix must contain 1 to 10 uppercase letters or numbers.",
    );
  }

  if (
    !Number.isSafeInteger(value.codeLength) ||
    value.codeLength < 3 ||
    value.codeLength > 20 ||
    value.prefix.length >= value.codeLength
  ) {
    throw new RequirementValidationError(
      "Requirement code length must be between 3 and 20 and leave room for its sequence.",
    );
  }

  if (typeof value.nextSequence !== "bigint" || value.nextSequence < 1n) {
    throw new RequirementValidationError("Requirement next sequence must be a positive integer.");
  }

  if (value.nextSequence.toString().length > value.codeLength - value.prefix.length) {
    throw new RequirementValidationError(
      "Requirement next sequence does not fit the configured code length.",
    );
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new RequirementValidationError(
      "Requirement code settings version must be a positive integer.",
    );
  }

  return value;
}

function normalizeActorUserId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequirementValidationError(
      "A Requirement change must identify its authenticated actor.",
    );
  }

  return value;
}

function normalizeRequirementClientId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequirementValidationError("Requirement Client id must be a non-empty string.");
  }

  return value;
}

function normalizeRequirementId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RequirementValidationError("Requirement id must be a non-empty string.");
  }

  return value;
}

function normalizeRequirementName(value: unknown): string {
  if (typeof value !== "string") {
    throw new RequirementValidationError("Requirement name must be a string.");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 200) {
    throw new RequirementValidationError(
      "Requirement name must contain between 1 and 200 characters.",
    );
  }

  return name;
}

function normalizeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== "string" || value.length > 2000) {
    throw new RequirementValidationError(
      "Requirement description must contain at most 2000 characters.",
    );
  }

  return value;
}

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequirementValidationError(`${field} must use the YYYY-MM-DD format.`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new RequirementValidationError(`${field} must be a valid calendar date.`);
  }

  return value;
}

function normalizeOptionalDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return normalizeDate(value, field);
}

function normalizeRequirementStatus(value: unknown): RequirementStatus {
  if (!(requirementStatuses as readonly string[]).includes(value as string)) {
    throw new RequirementValidationError(
      "Requirement status must be new, in_analysis, quoted, approved, in_execution, finalized, paused, or cancelled.",
    );
  }

  return value as RequirementStatus;
}

function normalizeSearchQuery(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RequirementValidationError("Requirement search query must be a string.");
  }

  return value.trim() || null;
}

function validateRequirementTransition(
  current: Pick<Requirement, "pausedFromStatus" | "status">,
  nextStatus: RequirementStatus,
): void {
  if (current.status === "paused") {
    if (current.pausedFromStatus === null) {
      throw new RequirementValidationError("A paused Requirement must preserve its previous status.");
    }

    if (nextStatus === "cancelled" || nextStatus === current.pausedFromStatus) {
      return;
    }

    throw new RequirementValidationError(
      "A paused Requirement can only resume its previous status or be cancelled.",
    );
  }

  if (current.status === nextStatus) {
    return;
  }

  if (current.status === "finalized" || current.status === "cancelled") {
    throw new RequirementValidationError(
      "Terminal Requirements cannot transition to another status.",
    );
  }

  if (nextStatus === "paused") {
    return;
  }

  if (nextStatus === "cancelled") {
    return;
  }

  const directTransitions: Partial<Record<RequirementStatus, RequirementStatus>> = {
    approved: "in_execution",
    in_analysis: "quoted",
    in_execution: "finalized",
    new: "in_analysis",
    quoted: "approved",
  };

  if (directTransitions[current.status] !== nextStatus) {
    throw new RequirementValidationError(
      "Requirement status must follow the configured sequential workflow.",
    );
  }
}

function resolvePausedFromStatus(
  current: Pick<Requirement, "pausedFromStatus" | "status">,
  nextStatus: RequirementStatus,
): RequirementPausableStatus | null {
  if (nextStatus === "paused") {
    return current.status as RequirementPausableStatus;
  }

  return null;
}

function validateRequirementDates(value: {
  approvedByUserId: string | null;
  approvedOn: string | null;
  committedOn: string | null;
  quotedOn: string | null;
  requestedOn: string;
  pausedFromStatus: RequirementPausableStatus | null;
  status: RequirementStatus;
}): void {
  for (const [field, date] of [
    ["committed", value.committedOn],
    ["quoted", value.quotedOn],
    ["approved", value.approvedOn],
  ] as const) {
    if (date !== null && date < value.requestedOn) {
      throw new RequirementValidationError(
        `Requirement ${field} date must be the same as or later than its requested date.`,
      );
    }
  }

  const effectiveStatus = value.status === "paused" ? value.pausedFromStatus : value.status;

  if (
    effectiveStatus !== null &&
    ["quoted", "approved", "in_execution", "finalized"].includes(effectiveStatus) &&
    value.quotedOn === null
  ) {
    throw new RequirementValidationError(
      "Quoted and later Requirement statuses require a quoted date.",
    );
  }

  if (
    effectiveStatus !== null &&
    ["approved", "in_execution", "finalized"].includes(effectiveStatus) &&
    (value.approvedOn === null || value.approvedByUserId === null)
  ) {
    throw new RequirementValidationError(
      "Approved and later Requirement statuses require an approval date and approver.",
    );
  }
}
