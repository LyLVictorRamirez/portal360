import assert from "node:assert/strict";
import test from "node:test";

import { authorizationPermissionKeys, isAuthorizationPermission } from "./permissions.js";

test("recognizes the fixed Client permission catalog", () => {
  for (const permission of ["clients.read", "clients.manage", "clients.settings.manage"]) {
    assert.equal(isAuthorizationPermission(permission), true);
  }

  assert.equal(isAuthorizationPermission("clients.delete"), false);
  assert.equal(authorizationPermissionKeys.includes("clients.read"), true);
});
