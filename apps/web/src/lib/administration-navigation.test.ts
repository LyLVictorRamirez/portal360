import assert from "node:assert/strict";
import test from "node:test";

import { getVisibleAdministrationNavigation } from "./administration-navigation.ts";

test("hides the administration section without an authorization permission", () => {
  assert.deepEqual(getVisibleAdministrationNavigation(["app.access"]), []);
});

test("shows each administration option for its read or manage permission", () => {
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "authorization.users.manage"]).map(
      (item) => item.id,
    ),
    ["users"],
  );
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "authorization.roles.read"]).map(
      (item) => item.id,
    ),
    ["roles"],
  );
});

test("shows both administration options when their permissions are present", () => {
  assert.deepEqual(
    getVisibleAdministrationNavigation([
      "app.access",
      "authorization.users.read",
      "authorization.roles.manage",
    ]).map((item) => item.id),
    ["users", "roles"],
  );
});
