import assert from "node:assert/strict";
import test from "node:test";

import { canManageProjectStages, shouldLoadProjectStages } from "./project-stages-access.ts";

test("allows managing Project Stages only with projects.manage on non-terminal Projects", () => {
  assert.equal(canManageProjectStages(true, "new"), true);
  assert.equal(canManageProjectStages(false, "in_execution"), false);
  assert.equal(canManageProjectStages(true, "finalized"), false);
  assert.equal(canManageProjectStages(true, "cancelled"), false);
});

test("loads Project Stages only from the existing detail mode", () => {
  assert.equal(shouldLoadProjectStages("view"), true);
  assert.equal(shouldLoadProjectStages("create"), false);
  assert.equal(shouldLoadProjectStages("edit"), false);
});
