import assert from "node:assert/strict";
import test from "node:test";

import {
  TicketClientInactiveError,
  TicketRelatedRecordsError,
  TicketVersionConflictError,
} from "./tickets.contracts.js";
import { TicketRepository, type TicketsDatabase } from "./tickets.repository.js";

const clientId = "f6323093-e2fb-4875-a787-d1542064d138";

test("rejects Ticket creation for an inactive Client before inserting", async () => {
  const queries: string[] = [];
  let released = false;
  const database: TicketsDatabase = {
    async connect() {
      return {
        async query(query: string) {
          queries.push(query);

          if (query.includes('select "is_active"')) {
            return { rowCount: 1, rows: [{ is_active: false }] };
          }

          return { rowCount: 0, rows: [] };
        },
        release() {
          released = true;
        },
      };
    },
    async query() {
      throw new Error("This test only expects transactional queries.");
    },
  };
  const repository = new TicketRepository(database);

  await assert.rejects(
    () =>
      repository.createTicket({
        actorUserId: "user-1",
        clientId,
        description: null,
        externalPriority: "medium",
        externalReference: "EXT-001",
        externalUrl: null,
        title: "Ticket Uno",
      }),
    TicketClientInactiveError,
  );

  assert.equal(
    queries.some((query) => query.includes('insert into "business"."ticket"')),
    false,
  );
  assert.equal(queries.at(-1), "ROLLBACK");
  assert.equal(released, true);
});

test("maps a Ticket foreign-key restriction to a controlled deletion error", async () => {
  const foreignKeyError = Object.assign(new Error("relation exists"), { code: "23503" });
  const database: TicketsDatabase = {
    async connect() {
      throw new Error("This test does not create transactions.");
    },
    async query() {
      throw foreignKeyError;
    },
  };
  const repository = new TicketRepository(database);

  await assert.rejects(() => repository.deleteTicket("ticket-1"), TicketRelatedRecordsError);
});

test("does not overwrite a Ticket when its version is stale", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const database: TicketsDatabase = {
    async connect() {
      throw new Error("This test does not create transactions.");
    },
    async query(sql, values) {
      queries.push({ sql, values });
      return sql.includes('where "ticket"."id" = $1')
        ? { rowCount: 1, rows: [{ id: "ticket-1" }] }
        : { rowCount: 0, rows: [] };
    },
  };
  const repository = new TicketRepository(database);

  await assert.rejects(
    () =>
      repository.updateTicket("ticket-1", { actorUserId: "user-2", title: "Cambio", version: 1 }),
    TicketVersionConflictError,
  );
  assert.match(queries[0]?.sql ?? "", /where "id" = \$1 and "version" = \$10/i);
  assert.equal(queries[0]?.values?.at(-1), 1);
});

test("lists Tickets from inactive Clients with the requested filters and stable order", async () => {
  const queries: Array<{ sql: string; values?: unknown[] }> = [];
  const database: TicketsDatabase = {
    async connect() {
      throw new Error("This test does not create transactions.");
    },
    async query(sql, values) {
      queries.push({ sql, values });
      return sql.includes("count(*)")
        ? { rowCount: 1, rows: [{ total: 0 }] }
        : { rowCount: 0, rows: [] };
    },
  };
  const repository = new TicketRepository(database);

  const list = await repository.listTickets({
    clientId,
    page: 2,
    pageSize: 25,
    priority: "high",
    query: "EXT-001",
  });

  assert.deepEqual(list, { page: 2, pageSize: 25, tickets: [], total: 0 });
  assert.deepEqual(queries[0]?.values, ["EXT-001", clientId, "high", 25, 25]);
  assert.match(queries[0]?.sql ?? "", /order by "ticket"\."updated_at" desc, "ticket"\."id" desc/i);
  assert.doesNotMatch(queries[0]?.sql ?? "", /"is_active"/i);
});
