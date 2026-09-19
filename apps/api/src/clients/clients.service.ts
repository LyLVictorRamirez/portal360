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
} from "./clients.contracts.js";
import { ClientRepository } from "./clients.repository.js";

const clientListPageSize = 25;

export interface ClientStore {
  createClient(input: CreateClientRecordInput): Promise<Client>;
  getCodeSettings(): Promise<ClientCodeSettings>;
  listClients(query: ListClientsQuery): Promise<ClientList>;
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

function normalizeSearchQuery(value: unknown): string | null {
  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ClientValidationError("Client search query must be a string.");
  }

  return value.trim() || null;
}
