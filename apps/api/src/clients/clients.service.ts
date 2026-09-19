import { Inject, Injectable } from "@nestjs/common";

import {
  type Client,
  type ClientCodeSettings,
  type ClientList,
  type CreateClientInput,
  type CreateClientRecordInput,
  type ListClientsInput,
  type ListClientsQuery,
  ClientValidationError,
  type UpdateClientInput,
  type UpdateClientCodeSettingsInput,
  type UpdateClientCodeSettingsRecordInput,
  type UpdateClientRecordInput,
} from "./clients.contracts.js";
import { ClientRepository } from "./clients.repository.js";

const clientListPageSize = 25;

export interface ClientStore {
  createClient(input: CreateClientRecordInput): Promise<Client>;
  deleteClient(clientId: string): Promise<void>;
  getClient(clientId: string): Promise<Client>;
  getCodeSettings(): Promise<ClientCodeSettings>;
  listClients(query: ListClientsQuery): Promise<ClientList>;
  updateCodeSettings(input: UpdateClientCodeSettingsRecordInput): Promise<ClientCodeSettings>;
  updateClient(clientId: string, input: UpdateClientRecordInput): Promise<Client>;
}

@Injectable()
export class ClientService {
  constructor(@Inject(ClientRepository) private readonly clientRepository: ClientStore) {}

  async getCodeSettings(): Promise<ClientCodeSettings> {
    return this.clientRepository.getCodeSettings();
  }

  async createClient(input: CreateClientInput, actorUserId: string): Promise<Client> {
    const name = normalizeClientName(input.name);
    const actor = normalizeActorUserId(actorUserId);

    return this.clientRepository.createClient({ actorUserId: actor, name });
  }

  async getClient(clientId: string): Promise<Client> {
    return this.clientRepository.getClient(normalizeClientId(clientId));
  }

  async listClients(input: ListClientsInput = {}): Promise<ClientList> {
    const page = input.page ?? 1;

    if (!Number.isSafeInteger(page) || page < 1) {
      throw new ClientValidationError("Client list page must be a positive integer.");
    }

    const status = input.status ?? "all";

    return this.clientRepository.listClients({
      isActive: status === "all" ? null : status === "active",
      page,
      pageSize: clientListPageSize,
      query: normalizeSearchQuery(input.query),
    });
  }

  async updateClient(
    clientId: string,
    input: UpdateClientInput,
    actorUserId: string,
  ): Promise<Client> {
    return this.clientRepository.updateClient(normalizeClientId(clientId), {
      ...normalizeClientUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async updateCodeSettings(
    input: UpdateClientCodeSettingsInput,
    actorUserId: string,
  ): Promise<ClientCodeSettings> {
    return this.clientRepository.updateCodeSettings({
      ...normalizeCodeSettingsUpdate(input),
      actorUserId: normalizeActorUserId(actorUserId),
    });
  }

  async deleteClient(clientId: string): Promise<void> {
    await this.clientRepository.deleteClient(normalizeClientId(clientId));
  }
}

function normalizeActorUserId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ClientValidationError("A Client change must identify its authenticated actor.");
  }

  return value;
}

function normalizeClientName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ClientValidationError("Client name must be a string.");
  }

  const name = value.trim();

  if (name.length < 1 || name.length > 200) {
    throw new ClientValidationError("Client name must contain between 1 and 200 characters.");
  }

  return name;
}

function normalizeClientId(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ClientValidationError("Client id must be a non-empty string.");
  }

  return value;
}

function normalizeClientUpdate(value: UpdateClientInput): UpdateClientInput {
  if (typeof value !== "object" || value === null) {
    throw new ClientValidationError("Client update must be an object.");
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new ClientValidationError("Client version must be a positive integer.");
  }

  const name = value.name === undefined ? undefined : normalizeClientName(value.name);

  if (value.isActive !== undefined && typeof value.isActive !== "boolean") {
    throw new ClientValidationError("Client active state must be a boolean.");
  }

  if (name === undefined && value.isActive === undefined) {
    throw new ClientValidationError("A Client update must change its name or active state.");
  }

  const update: UpdateClientInput = { version: value.version };

  if (name !== undefined) {
    update.name = name;
  }

  if (value.isActive !== undefined) {
    update.isActive = value.isActive;
  }

  return update;
}

function normalizeSearchQuery(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ClientValidationError("Client search query must be a string.");
  }

  return value.trim() || null;
}

function normalizeCodeSettingsUpdate(
  value: UpdateClientCodeSettingsInput,
): UpdateClientCodeSettingsInput {
  if (typeof value !== "object" || value === null) {
    throw new ClientValidationError("Client code settings update must be an object.");
  }

  if (typeof value.prefix !== "string" || !/^[A-Z0-9]{1,10}$/.test(value.prefix)) {
    throw new ClientValidationError(
      "Client code prefix must contain 1 to 10 uppercase letters or numbers.",
    );
  }

  if (
    !Number.isSafeInteger(value.codeLength) ||
    value.codeLength < 3 ||
    value.codeLength > 20 ||
    value.prefix.length >= value.codeLength
  ) {
    throw new ClientValidationError(
      "Client code length must be between 3 and 20 and leave room for its sequence.",
    );
  }

  if (typeof value.nextSequence !== "bigint" || value.nextSequence < 1n) {
    throw new ClientValidationError("Client next sequence must be a positive integer.");
  }

  if (value.nextSequence.toString().length > value.codeLength - value.prefix.length) {
    throw new ClientValidationError(
      "Client next sequence does not fit the configured code length.",
    );
  }

  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new ClientValidationError("Client code settings version must be a positive integer.");
  }

  return value;
}
