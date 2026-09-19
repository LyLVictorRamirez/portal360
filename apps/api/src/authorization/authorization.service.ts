import { Inject, Injectable } from "@nestjs/common";

import { AuthorizationRepository } from "./authorization.repository.js";
import type { AuthorizationPermission } from "./permissions.js";
import type { UserAuthorization } from "./authorization.types.js";

@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(AuthorizationRepository)
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  async resolveUserAuthorization(userId: string): Promise<UserAuthorization> {
    return this.authorizationRepository.findUserAuthorization(userId);
  }

  async userHasPermission(userId: string, permission: AuthorizationPermission): Promise<boolean> {
    const authorization = await this.resolveUserAuthorization(userId);

    return authorization.permissions.includes(permission);
  }
}
