export type ClientStatusFilter = "active" | "all" | "inactive";

export interface Client {
  code: string;
  createdAt: Date;
  createdByUserId: string;
  id: string;
  isActive: boolean;
  name: string;
  updatedAt: Date;
  updatedByUserId: string;
  version: number;
}

export interface ClientCodeSettings {
  codeLength: number;
  createdAt: Date;
  createdByUserId: string | null;
  nextSequence: bigint;
  prefix: string;
  updatedAt: Date;
  updatedByUserId: string | null;
  version: number;
}

export interface ClientList {
  clients: Client[];
  page: number;
  pageSize: number;
  total: number;
}

export interface CreateClientInput {
  name: string;
}

export interface CreateClientRecordInput extends CreateClientInput {
  actorUserId: string;
}

export interface UpdateClientInput {
  isActive?: boolean;
  name?: string;
  version: number;
}

export interface UpdateClientRecordInput extends UpdateClientInput {
  actorUserId: string;
}

export interface ListClientsInput {
  page?: number;
  query?: string;
  status?: ClientStatusFilter;
}

export interface ListClientsQuery {
  isActive: boolean | null;
  page: number;
  pageSize: number;
  query: string | null;
}

export class ClientCodeExhaustedError extends Error {}

export class ClientCodeSettingsNotFoundError extends Error {}

export class ClientNotFoundError extends Error {}

export class ClientRelatedRecordsError extends Error {}

export class ClientValidationError extends Error {}

export class ClientVersionConflictError extends Error {}
