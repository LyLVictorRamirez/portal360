import { Controller, Get, UseGuards } from "@nestjs/common";

import { AuthorizationContext } from "./authorization-context.decorator.js";
import { AuthorizationGuard } from "./authorization.guard.js";
import { appAccessPermission } from "./permissions.js";
import { RequirePermissions } from "./require-permissions.decorator.js";
import type { AuthorizationRequestContext, UserAuthorization } from "./authorization.types.js";

@Controller("api/authorization")
@UseGuards(AuthorizationGuard)
export class AuthorizationController {
  @Get("me")
  @RequirePermissions(appAccessPermission)
  getCurrentAuthorization(
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): UserAuthorization {
    return context.authorization;
  }
}
