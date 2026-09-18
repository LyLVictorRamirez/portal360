import assert from "node:assert/strict";
import test from "node:test";

import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import type { IncomingMessage } from "node:http";

import {
  AuthorizationContextService,
  type AuthorizationContextResolver,
  type BetterAuthSessionResolver,
  type UserAuthorizationResolver,
} from "./authorization-context.service.js";
import { AuthorizationGuard, type AuthorizedRequest } from "./authorization.guard.js";
import { RequirePermissions } from "./require-permissions.decorator.js";

class ProtectedController {
  @RequirePermissions("authorization.roles.manage")
  protectedRoute() {}
}

function createExecutionContext(
  request: AuthorizedRequest,
  handler: () => void = ProtectedController.prototype.protectedRoute,
): ExecutionContext {
  return {
    getClass: () => ProtectedController,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  } as unknown as ExecutionContext;
}

test("returns 401 when Better Auth does not resolve a session", async () => {
  const authService: BetterAuthSessionResolver = {
    api: {
      getSession: async () => null,
    },
  };
  const authorizationService: UserAuthorizationResolver = {
    resolveUserAuthorization: async () => ({
      permissions: [],
      roles: [],
    }),
  };
  const contextService = new AuthorizationContextService(authService, authorizationService);

  await assert.rejects(
    () => contextService.resolve({ headers: {} } as IncomingMessage),
    (error: unknown) => error instanceof UnauthorizedException && error.getStatus() === 401,
  );
});

test("returns 403 when the authenticated user lacks a required permission", async () => {
  const request = { headers: {} } as AuthorizedRequest;
  const contextService: AuthorizationContextResolver = {
    resolve: async () => ({
      authorization: {
        permissions: ["app.access"],
        roles: [],
      },
      userId: "user-1",
    }),
  };
  const guard = new AuthorizationGuard(new Reflector(), contextService);

  await assert.rejects(
    () => guard.canActivate(createExecutionContext(request)),
    (error: unknown) => error instanceof ForbiddenException && error.getStatus() === 403,
  );
  assert.equal(request.authorizationContext?.userId, "user-1");
});

test("allows a verified session that has every required permission", async () => {
  const request = { headers: {} } as AuthorizedRequest;
  const contextService: AuthorizationContextResolver = {
    resolve: async () => ({
      authorization: {
        permissions: ["app.access", "authorization.roles.manage"],
        roles: [],
      },
      userId: "user-1",
    }),
  };
  const guard = new AuthorizationGuard(new Reflector(), contextService);

  assert.equal(await guard.canActivate(createExecutionContext(request)), true);
});
