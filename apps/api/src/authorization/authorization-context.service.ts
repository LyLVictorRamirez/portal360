import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "@thallesp/nestjs-better-auth";
import { fromNodeHeaders } from "better-auth/node";
import type { IncomingMessage } from "node:http";

import { AuthorizationService } from "./authorization.service.js";
import type { AuthorizationRequestContext } from "./authorization.types.js";

export interface BetterAuthSessionResolver {
  api: {
    getSession(options: { headers: Headers }): Promise<{
      user: {
        emailVerified: boolean;
        id: string;
      };
    } | null>;
  };
}

export interface UserAuthorizationResolver {
  resolveUserAuthorization(userId: string): Promise<AuthorizationRequestContext["authorization"]>;
}

export interface AuthorizationContextResolver {
  resolve(request: IncomingMessage): Promise<AuthorizationRequestContext>;
}

@Injectable()
export class AuthorizationContextService implements AuthorizationContextResolver {
  constructor(
    @Inject(AuthService)
    private readonly authService: BetterAuthSessionResolver,
    @Inject(AuthorizationService)
    private readonly authorizationService: UserAuthorizationResolver,
  ) {}

  async resolve(request: IncomingMessage): Promise<AuthorizationRequestContext> {
    const session = await this.authService.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      throw new UnauthorizedException("Authentication is required.");
    }

    if (!session.user.emailVerified) {
      throw new ForbiddenException("Email verification is required.");
    }

    return {
      authorization: await this.authorizationService.resolveUserAuthorization(session.user.id),
      userId: session.user.id,
    };
  }
}
