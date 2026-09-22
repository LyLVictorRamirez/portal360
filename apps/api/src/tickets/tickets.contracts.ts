export const ticketExternalPriorities = ["critical", "high", "medium", "low"] as const;

export type TicketExternalPriority = (typeof ticketExternalPriorities)[number];
export type TicketExternalPriorityFilter = "all" | TicketExternalPriority;

export interface TicketClientReference {
  code: string;
  id: string;
  name: string;
}

export interface Ticket {
  client: TicketClientReference;
  createdAt: Date;
  createdByUserId: string;
  description: string | null;
  externalPriority: TicketExternalPriority;
  externalReference: string;
  externalUrl: string | null;
  id: string;
  title: string;
  updatedAt: Date;
  updatedByUserId: string;
  version: number;
}

export interface TicketList {
  page: number;
  pageSize: number;
  tickets: Ticket[];
  total: number;
}

export interface CreateTicketInput {
  clientId: string;
  description?: string | null;
  externalPriority?: TicketExternalPriority;
  externalReference: string;
  externalUrl?: string | null;
  title: string;
}

export interface CreateTicketRecordInput extends Required<CreateTicketInput> {
  actorUserId: string;
}

export interface UpdateTicketInput {
  description?: string | null;
  externalPriority?: TicketExternalPriority;
  externalReference?: string;
  externalUrl?: string | null;
  title?: string;
  version: number;
}

export interface UpdateTicketRecordInput extends UpdateTicketInput {
  actorUserId: string;
}

export interface ListTicketsInput {
  clientId?: string;
  page?: number;
  priority?: TicketExternalPriorityFilter;
  query?: string;
}

export interface ListTicketsQuery {
  clientId: string | null;
  page: number;
  pageSize: number;
  priority: TicketExternalPriority | null;
  query: string | null;
}

export class TicketClientInactiveError extends Error {}
export class TicketClientNotFoundError extends Error {}
export class TicketNotFoundError extends Error {}
export class TicketRelatedRecordsError extends Error {}
export class TicketValidationError extends Error {}
export class TicketVersionConflictError extends Error {}
