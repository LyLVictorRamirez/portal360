import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { AuthorizedRequest } from "./authorization.guard.js";
import type { AuthorizationRequestContext } from "./authorization.types.js";

export const AuthorizationContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthorizationRequestContext => {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();

    if (!request.authorizationContext) {
      throw new Error("Authorization context is unavailable.");
    }

    return request.authorizationContext;
  },
);
