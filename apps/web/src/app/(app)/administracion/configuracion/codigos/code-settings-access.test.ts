import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleCodeSettingsEntities } from "./code-settings-access.ts";

test("shows each code setting section only for its dedicated permission", () => {
  assert.deepEqual(getVisibleCodeSettingsEntities(["clients.settings.manage"]), ["client"]);
  assert.deepEqual(getVisibleCodeSettingsEntities(["projects.settings.manage"]), ["project"]);
  assert.deepEqual(getVisibleCodeSettingsEntities(["requirements.settings.manage"]), [
    "requirement",
  ]);
});

test("shows all code setting sections when their permissions are granted", () => {
  assert.deepEqual(
    getVisibleCodeSettingsEntities([
      "clients.settings.manage",
      "projects.settings.manage",
      "requirements.settings.manage",
    ]),
    ["client", "project", "requirement"],
  );
});

test("does not show a code setting section without its dedicated permission", () => {
  assert.deepEqual(getVisibleCodeSettingsEntities(["requirements.manage"]), []);
});
