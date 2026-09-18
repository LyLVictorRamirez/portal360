import { Inject, Injectable } from "@nestjs/common";

import { AuthorizationUsersRepository } from "./authorization-users.repository.js";
import type { AuthorizationRole, AuthorizationUser } from "./authorization.types.js";

export interface AuthorizationUsersStore {
  listUsers(search: string): Promise<AuthorizationUser[]>;
  replaceUserRoles(userId: string, roleKeys: string[]): Promise<AuthorizationRole[]>;
}

@Injectable()
export class AuthorizationUsersService {
  constructor(
    @Inject(AuthorizationUsersRepository)
    private readonly authorizationUsersRepository: AuthorizationUsersStore,
  ) {}

  async listUsers(search: string | undefined): Promise<AuthorizationUser[]> {
    return this.authorizationUsersRepository.listUsers(search?.trim() ?? "");
  }

  async replaceUserRoles(userId: string, roleKeys: string[]): Promise<AuthorizationRole[]> {
    return this.authorizationUsersRepository.replaceUserRoles(userId, roleKeys);
  }
}
