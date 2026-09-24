import assert from "node:assert/strict";
import test from "node:test";

import { activityStatusTones } from "./activity-status-presentation.ts";

test("maps Activity states to the equivalent Project and Requirement color semantics", () => {
  assert.deepEqual(activityStatusTones, {
    blocked: "danger",
    customer_testing: "approved",
    finalized: "info",
    in_progress: "success",
    in_review: "analysis",
    pending: "planned",
    waiting_third_party: "paused",
  });
});
