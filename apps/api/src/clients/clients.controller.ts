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
  type Client,
  ClientCodeExhaustedError,
  ClientCodeSettingsNotFoundError,
  type ClientCodeSettings,
  type ClientList,
  ClientNotFoundError,
  ClientRelatedRecordsError,
  type ClientStatusFilter,
  ClientValidationError,
  ClientVersionConflictError,
  type CreateClientInput,
  type ListClientsInput,
  type UpdateClientCodeSettingsInput,
  type UpdateClientInput,
} from "./clients.contracts.js";
import { ClientService } from "./clients.service.js";

interface ClientResponse {
  code: string;
  id: string;
  isActive: boolean;
  name: string;
  version: number;
}

interface ClientCodeSettingsResponse {
  codeLength: number;
  nextSequence: string;
  prefix: string;
  version: number;
}

export interface ClientsControllerStore {
  createClient(input: CreateClientInput, actorUserId: string): Promise<Client>;
  deleteClient(clientId: string): Promise<void>;
  getClient(clientId: string): Promise<Client>;
  getCodeSettings(): Promise<ClientCodeSettings>;
  listClients(input: ListClientsInput): Promise<ClientList>;
  updateClient(clientId: string, input: UpdateClientInput, actorUserId: string): Promise<Client>;
  updateCodeSettings(
    input: UpdateClientCodeSettingsInput,
    actorUserId: string,
  ): Promise<ClientCodeSettings>;
}

@Controller("api/clients")
@UseGuards(AuthorizationGuard)
export class ClientsController {
  constructor(@Inject(ClientService) private readonly clientService: ClientsControllerStore) {}

  @Get()
  @RequirePermissions("clients.read")
  async listClients(
    @Query("page") page: string | undefined,
    @Query("query") query: string | undefined,
    @Query("status") status: string | undefined,
  ): Promise<{ clients: ClientResponse[]; page: number; pageSize: number; total: number }> {
    const clients = await this.clientService.listClients({
      page: readOptionalPage(page),
      query,
      status: readOptionalStatus(status),
    });

    return {
      clients: clients.clients.map(toClientResponse),
      page: clients.page,
      pageSize: clients.pageSize,
      total: clients.total,
    };
  }

  @Post()
  @RequirePermissions("clients.manage")
  async createClient(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ client: ClientResponse }> {
    try {
      return {
        client: toClientResponse(
          await this.clientService.createClient(readCreateClientInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get("settings/code")
  @RequirePermissions("clients.settings.manage")
  async getCodeSettings(): Promise<{ settings: ClientCodeSettingsResponse }> {
    try {
      return { settings: toCodeSettingsResponse(await this.clientService.getCodeSettings()) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put("settings/code")
  @RequirePermissions("clients.settings.manage")
  async updateCodeSettings(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ settings: ClientCodeSettingsResponse }> {
    try {
      return {
        settings: toCodeSettingsResponse(
          await this.clientService.updateCodeSettings(readUpdateCodeSettingsInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Get(":clientId")
  @RequirePermissions("clients.read")
  async getClient(@Param("clientId") clientId: string): Promise<{ client: ClientResponse }> {
    try {
      return { client: toClientResponse(await this.clientService.getClient(clientId)) };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Put(":clientId")
  @RequirePermissions("clients.manage")
  async updateClient(
    @Param("clientId") clientId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ client: ClientResponse }> {
    try {
      return {
        client: toClientResponse(
          await this.clientService.updateClient(clientId, readUpdateClientInput(body), context.userId),
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Delete(":clientId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("clients.manage")
  async deleteClient(@Param("clientId") clientId: string): Promise<void> {
    try {
      await this.clientService.deleteClient(clientId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateClientInput(body: unknown): CreateClientInput {
  const record = readRecord(body);

  if (typeof record.name !== "string") {
    throw new BadRequestException("name is required.");
  }

  return { name: record.name };
}

function readUpdateClientInput(body: unknown): UpdateClientInput {
  const record = readRecord(body);
  const input: UpdateClientInput = { version: readPositiveInteger(record.version, "version") };

  if (record.name !== undefined) {
    if (typeof record.name !== "string") {
      throw new BadRequestException("name must be a string when provided.");
    }

    input.name = record.name;
  }

  if (record.isActive !== undefined) {
    if (typeof record.isActive !== "boolean") {
      throw new BadRequestException("isActive must be a boolean when provided.");
    }

    input.isActive = record.isActive;
  }

  return input;
}

function readUpdateCodeSettingsInput(body: unknown): UpdateClientCodeSettingsInput {
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

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
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

function readOptionalStatus(value: string | undefined): ClientStatusFilter | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "active" || value === "inactive" || value === "all") {
    return value;
  }

  throw new BadRequestException("status must be active, inactive, or all.");
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

function toClientResponse(client: Client): ClientResponse {
  return {
    code: client.code,
    id: client.id,
    isActive: client.isActive,
    name: client.name,
    version: client.version,
  };
}

function toCodeSettingsResponse(settings: {
  codeLength: number;
  nextSequence: bigint;
  prefix: string;
  version: number;
}): ClientCodeSettingsResponse {
  return {
    codeLength: settings.codeLength,
    nextSequence: settings.nextSequence.toString(),
    prefix: settings.prefix,
    version: settings.version,
  };
}

function toHttpException(error: unknown): Error {
  if (error instanceof ClientNotFoundError || error instanceof ClientCodeSettingsNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (
    error instanceof ClientCodeExhaustedError ||
    error instanceof ClientRelatedRecordsError ||
    error instanceof ClientVersionConflictError
  ) {
    return new ConflictException(error.message);
  }

  if (error instanceof ClientValidationError) {
    return new BadRequestException(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Client operation failed.");
}
