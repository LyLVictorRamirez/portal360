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

test("recognizes the fixed Project permission catalog", () => {
  for (const permission of ["projects.read", "projects.manage", "projects.settings.manage"]) {
    assert.equal(isAuthorizationPermission(permission), true);
  }

  assert.equal(isAuthorizationPermission("projects.delete"), false);
  assert.equal(authorizationPermissionKeys.includes("projects.read"), true);
});

test("recognizes the fixed Requirement permission catalog", () => {
  for (const permission of [
    "requirements.read",
    "requirements.manage",
    "requirements.settings.manage",
  ]) {
    assert.equal(isAuthorizationPermission(permission), true);
  }

  assert.equal(isAuthorizationPermission("requirements.delete"), false);
  assert.equal(authorizationPermissionKeys.includes("requirements.read"), true);
});

test("recognizes the fixed Ticket permission catalog", () => {
  for (const permission of ["tickets.read", "tickets.manage"]) {
    assert.equal(isAuthorizationPermission(permission), true);
  }

  assert.equal(isAuthorizationPermission("tickets.delete"), false);
  assert.equal(authorizationPermissionKeys.includes("tickets.read"), true);
});
