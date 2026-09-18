import assert from "node:assert/strict";
import test from "node:test";

import { AuthorizationController } from "./authorization.controller.js";

test("returns only the effective roles and permissions from the authorization context", () => {
  const controller = new AuthorizationController();

  assert.deepEqual(
    controller.getCurrentAuthorization({
      authorization: {
        permissions: ["app.access", "authorization.users.read"],
        roles: [
          {
            description: "Minimum access.",
            isActive: true,
            isDefault: true,
            key: "estandar",
            kind: "system",
            name: "Estándar",
          },
        ],
      },
      userId: "user-1",
    }),
    {
      permissions: ["app.access", "authorization.users.read"],
      roles: [
        {
          description: "Minimum access.",
          isActive: true,
          isDefault: true,
          key: "estandar",
          kind: "system",
          name: "Estándar",
        },
      ],
    },
  );
});
