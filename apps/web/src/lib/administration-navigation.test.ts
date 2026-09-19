import assert from "node:assert/strict";
import test from "node:test";

import {
  getVisibleAdministrationNavigation,
  getVisibleClientNavigation,
} from "./administration-navigation.ts";

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

test("shows Clientes only to people with Client reading permission", () => {
  assert.deepEqual(getVisibleClientNavigation(["app.access"]), []);
  assert.deepEqual(getVisibleClientNavigation(["app.access", "clients.read"]), [
    {
      href: "/clientes",
      id: "clients",
      label: "Clientes",
      permissionKeys: ["clients.read"],
    },
  ]);
});

test("shows Client code settings only to people with its dedicated permission", () => {
  assert.deepEqual(getVisibleAdministrationNavigation(["app.access", "clients.read"]), []);
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "clients.settings.manage"]).map(
      (item) => item.id,
    ),
    ["client-code-settings"],
  );
});
