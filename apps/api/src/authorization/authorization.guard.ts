import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { IncomingMessage } from "node:http";

import {
  AuthorizationContextService,
  type AuthorizationContextResolver,
} from "./authorization-context.service.js";
import { requiredPermissionsMetadataKey } from "./require-permissions.decorator.js";
import type { AuthorizationPermission } from "./permissions.js";
import type { AuthorizationRequestContext } from "./authorization.types.js";

export interface AuthorizedRequest extends IncomingMessage {
  authorizationContext?: AuthorizationRequestContext;
}

@Injectable()
export class AuthorizationGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AuthorizationContextService)
    private readonly authorizationContextService: AuthorizationContextResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const authorizationContext = await this.authorizationContextService.resolve(request);
    const requiredPermissions = this.reflector.getAllAndOverride<AuthorizationPermission[]>(
      requiredPermissionsMetadataKey,
      [context.getHandler(), context.getClass()],
    );

    request.authorizationContext = authorizationContext;

    if (
      requiredPermissions &&
      !requiredPermissions.every((permission) =>
        authorizationContext.authorization.permissions.includes(permission),
      )
    ) {
      throw new ForbiddenException("The current user does not have the required permission.");
    }

    return true;
  }
}
