import assert from "node:assert/strict";
import test from "node:test";

import {
  getVisibleAdministrationNavigation,
  getVisibleBusinessNavigation,
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

test("shows Clientes, Proyectos, and Requerimientos only to people with their reading permission", () => {
  assert.deepEqual(getVisibleBusinessNavigation(["app.access"]), []);
  assert.deepEqual(getVisibleBusinessNavigation(["app.access", "clients.read"]), [
    {
      href: "/clientes",
      id: "clients",
      label: "Clientes",
      permissionKeys: ["clients.read"],
    },
  ]);
  assert.deepEqual(getVisibleBusinessNavigation(["app.access", "projects.read"]), [
    {
      href: "/proyectos",
      id: "projects",
      label: "Proyectos",
      permissionKeys: ["projects.read"],
    },
  ]);
  assert.deepEqual(getVisibleBusinessNavigation(["app.access", "requirements.read"]), [
    {
      href: "/requerimientos",
      id: "requirements",
      label: "Requerimientos",
      permissionKeys: ["requirements.read"],
    },
  ]);
});

test("shows the single code settings entry with either dedicated permission", () => {
  assert.deepEqual(getVisibleAdministrationNavigation(["app.access", "clients.read"]), []);
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "clients.settings.manage"]).map(
      (item) => item.id,
    ),
    ["code-settings"],
  );
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "projects.settings.manage"]).map(
      (item) => item.id,
    ),
    ["code-settings"],
  );
  assert.deepEqual(
    getVisibleAdministrationNavigation(["app.access", "requirements.settings.manage"]).map(
      (item) => item.id,
    ),
    ["code-settings"],
  );
});
