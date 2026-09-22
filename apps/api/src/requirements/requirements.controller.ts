import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { AuthorizationContext } from "../authorization/authorization-context.decorator.js";
import { AuthorizationGuard } from "../authorization/authorization.guard.js";
import { RequirePermissions } from "../authorization/require-permissions.decorator.js";
import type { AuthorizationRequestContext } from "../authorization/authorization.types.js";
import {
  type CreateRequirementInput,
  type ListRequirementsInput,
  type Requirement,
  RequirementClientInactiveError,
  RequirementClientNotFoundError,
  RequirementCodeExhaustedError,
  RequirementCodeSettingsNotFoundError,
  RequirementCodeSettingsVersionConflictError,
  type RequirementCodeSettings,
  type RequirementList,
  RequirementNotFoundError,
  RequirementRelatedRecordsError,
  type RequirementStatus,
  type RequirementStatusFilter,
  RequirementValidationError,
  RequirementVersionConflictError,
  type UpdateRequirementCodeSettingsInput,
  type UpdateRequirementInput,
} from "./requirements.contracts.js";
import { RequirementService } from "./requirements.service.js";

interface RequirementResponse {
  approvedByUserId: string | null;
  approvedByUserName: string | null;
  approvedOn: string | null;
  client: {
    code: string;
    id: string;
    name: string;
  };
  code: string;
  committedOn: string | null;
  description: string | null;
  id: string;
  name: string;
  pausedFromStatus: Requirement["pausedFromStatus"];
  quotedOn: string | null;
  requestedOn: string;
  status: RequirementStatus;
  version: number;
}

interface RequirementCodeSettingsResponse {
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}

export interface RequirementsControllerStore {
  createRequirement(input: CreateRequirementInput, actorUserId: string): Promise<Requirement>;
  deleteRequirement(requirementId: string): Promise<void>;
  getCodeSettings(): Promise<RequirementCodeSettings>;
  getRequirement(requirementId: string): Promise<Requirement>;
  listRequirements(input: ListRequirementsInput): Promise<RequirementList>;
  updateCodeSettings(
    input: UpdateRequirementCodeSettingsInput,
    actorUserId: string,
  ): Promise<RequirementCodeSettings>;
  updateRequirement(
    requirementId: string,
    input: UpdateRequirementInput,
    actorUserId: string,
  ): Promise<Requirement>;
}

@Controller("api/requirements")
@UseGuards(AuthorizationGuard)
export class RequirementsController {
  constructor(
    @Inject(RequirementService) private readonly requirementService: RequirementsControllerStore,
  ) {}

  @Get()
  @RequirePermissions("requirements.read")
  async listRequirements(
    @Query("page") page: string | undefined,
    @Query("query") query: string | undefined,
    @Query("clientId") clientId: string | undefined,
    @Query("status") status: string | undefined,
  ): Promise<{
    page: number;
    pageSize: number;
    requirements: RequirementResponse[];
    total: number;
  }> {
    const requirements = await this.requirementService.listRequirements({
      clientId,
      page: readOptionalPage(page),
      query,
      status: readOptionalListStatus(status),
    });

    return {
      page: requirements.page,
      pageSize: requirements.pageSize,
      requirements: requirements.requirements.map(toRequirementResponse),
      total: requirements.total,
    };
  }

  @Post()
  @RequirePermissions("requirements.manage")
  async createRequirement(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ requirement: RequirementResponse }> {
    try {
      return {
        requirement: toRequirementResponse(
          await this.requirementService.createRequirement(
            readCreateRequirementInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get("settings/code")
  @RequirePermissions("requirements.settings.manage")
  async getCodeSettings(): Promise<{ settings: RequirementCodeSettingsResponse }> {
    try {
      return { settings: toCodeSettingsResponse(await this.requirementService.getCodeSettings()) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put("settings/code")
  @RequirePermissions("requirements.settings.manage")
  async updateCodeSettings(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ settings: RequirementCodeSettingsResponse }> {
    try {
      return {
        settings: toCodeSettingsResponse(
          await this.requirementService.updateCodeSettings(
            readUpdateCodeSettingsInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get(":requirementId")
  @RequirePermissions("requirements.read")
  async getRequirement(
    @Param("requirementId") requirementId: string,
  ): Promise<{ requirement: RequirementResponse }> {
    try {
      return {
        requirement: toRequirementResponse(
          await this.requirementService.getRequirement(requirementId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":requirementId")
  @RequirePermissions("requirements.manage")
  async updateRequirement(
    @Param("requirementId") requirementId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ requirement: RequirementResponse }> {
    try {
      return {
        requirement: toRequirementResponse(
          await this.requirementService.updateRequirement(
            requirementId,
            readUpdateRequirementInput(body),
            context.userId,
          ),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Delete(":requirementId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("requirements.manage")
  async deleteRequirement(@Param("requirementId") requirementId: string): Promise<void> {
    try {
      await this.requirementService.deleteRequirement(requirementId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateRequirementInput(body: unknown): CreateRequirementInput {
  const record = readRecord(body);

  if (typeof record.clientId !== "string") {
    throw new BadRequestException("clientId is required.");
  }

  if (typeof record.name !== "string") {
    throw new BadRequestException("name is required.");
  }

  if (typeof record.requestedOn !== "string") {
    throw new BadRequestException("requestedOn is required.");
  }

  if (!isOptionalString(record.description)) {
    throw new BadRequestException("description must be a string or null when provided.");
  }

  if (!isOptionalString(record.committedOn)) {
    throw new BadRequestException("committedOn must be a string or null when provided.");
  }

  return {
    clientId: record.clientId,
    committedOn: record.committedOn as string | null | undefined,
    description: record.description as string | null | undefined,
    name: record.name,
    requestedOn: record.requestedOn,
  };
}

function readUpdateRequirementInput(body: unknown): UpdateRequirementInput {
  const record = readRecord(body);
  const input: UpdateRequirementInput = { version: readPositiveInteger(record.version, "version") };

  if (record.name !== undefined) {
    if (typeof record.name !== "string") {
      throw new BadRequestException("name must be a string when provided.");
    }

    input.name = record.name;
  }

  if (record.description !== undefined) {
    if (!isOptionalString(record.description)) {
      throw new BadRequestException("description must be a string or null when provided.");
    }

    input.description = record.description;
  }

  for (const [property, message] of [
    ["requestedOn", "requestedOn must be a string when provided."],
    ["committedOn", "committedOn must be a string or null when provided."],
    ["quotedOn", "quotedOn must be a string or null when provided."],
    ["approvedOn", "approvedOn must be a string or null when provided."],
  ] as const) {
    const value = record[property];

    if (value === undefined) {
      continue;
    }

    if (property === "requestedOn" ? typeof value !== "string" : !isOptionalString(value)) {
      throw new BadRequestException(message);
    }

    input[property] = value as never;
  }

  if (record.status !== undefined) {
    input.status = readRequiredStatus(record.status);
  }

  return input;
}

function readUpdateCodeSettingsInput(body: unknown): UpdateRequirementCodeSettingsInput {
  const record = readRecord(body);

  if (typeof record.prefix !== "string") {
    throw new BadRequestException("prefix is required.");
  }

  return {
    codeLength: readPositiveInteger(record.codeLength, "codeLength"),
    nextSequence: readPositiveBigInt(record.nextSequence, "nextSequence"),
    prefix: record.prefix,
    version: readPositiveInteger(record.version, "version"),
  };
}

function readOptionalPage(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^\d+$/.test(value)) {
    throw new BadRequestException("page must be a positive integer.");
  }

  return readPositiveInteger(Number(value), "page");
}

function readOptionalListStatus(value: unknown): RequirementStatusFilter | undefined {
  if (value === undefined || value === "all") {
    return value;
  }

  return readRequiredStatus(value);
}

function readRequiredStatus(value: unknown): RequirementStatus {
  if (
    value !== "new" &&
    value !== "in_analysis" &&
    value !== "quoted" &&
    value !== "approved" &&
    value !== "in_execution" &&
    value !== "finalized" &&
    value !== "paused" &&
    value !== "cancelled"
  ) {
    throw new BadRequestException(
      "status must be new, in_analysis, quoted, approved, in_execution, finalized, paused, or cancelled.",
    );
  }

  return value;
}

function isOptionalString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function readPositiveBigInt(value: unknown, field: string): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return BigInt(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value) && BigInt(value) > 0n) {
    return BigInt(value);
  }

  throw new BadRequestException(`${field} must be a positive integer.`);
}

function readPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return value;
}

function toRequirementResponse(requirement: Requirement): RequirementResponse {
  return {
    approvedByUserId: requirement.approvedByUserId,
    approvedByUserName: requirement.approvedByUserName,
    approvedOn: requirement.approvedOn,
    client: requirement.client,
    code: requirement.code,
    committedOn: requirement.committedOn,
    description: requirement.description,
    id: requirement.id,
    name: requirement.name,
    pausedFromStatus: requirement.pausedFromStatus,
    quotedOn: requirement.quotedOn,
    requestedOn: requirement.requestedOn,
    status: requirement.status,
    version: requirement.version,
  };
}

function toCodeSettingsResponse(settings: {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}): RequirementCodeSettingsResponse {
  return {
    codeLength: settings.codeLength,
    nextSequence: settings.nextSequence.toString(),
    prefix: settings.prefix,
    version: settings.version,
  };
}

function toHttpException(error: unknown): Error {
  if (
    error instanceof RequirementNotFoundError ||
    error instanceof RequirementClientNotFoundError ||
    error instanceof RequirementCodeSettingsNotFoundError
  ) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof RequirementCodeExhaustedError ||
    error instanceof RequirementCodeSettingsVersionConflictError ||
    error instanceof RequirementRelatedRecordsError ||
    error instanceof RequirementVersionConflictError
  ) {
    return new ConflictException(error.message);
  }

  if (
    error instanceof RequirementClientInactiveError ||
    error instanceof RequirementValidationError
  ) {
    return new BadRequestException(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Requirement operation failed.");
}
