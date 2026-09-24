import assert from "node:assert/strict";
import test from "node:test";

import { containerActivityLockQuery } from "./activities.repository.js";

test("locks Tickets without selecting a status that their schema does not contain", () => {
  assert.equal(
    containerActivityLockQuery("ticket", "ticket"),
    'select "id" from "business"."ticket" where "id" = $1 for update',
  );
});

test("keeps status available for terminal Project and Requirement validation", () => {
  assert.equal(
    containerActivityLockQuery("project", "project"),
    'select "status" from "business"."project" where "id" = $1 for update',
  );
  assert.equal(
    containerActivityLockQuery("requirement", "requirement"),
    'select "status" from "business"."requirement" where "id" = $1 for update',
  );
});
