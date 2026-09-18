import { Inject, Injectable } from "@nestjs/common";

import {
  AuthorizationRolesRepository,
  type CreateCustomRoleInput,
  type UpdateRoleInput,
} from "./authorization-roles.repository.js";
import type {
  AuthorizationPermissionDefinition,
  AuthorizationRoleDetails,
} from "./authorization.types.js";

export interface AuthorizationRolesStore {
  createCustomRole(input: CreateCustomRoleInput): Promise<AuthorizationRoleDetails>;
  deleteCustomRole(roleKey: string): Promise<void>;
  listRoleCatalog(): Promise<{
    permissions: AuthorizationPermissionDefinition[];
    roles: AuthorizationRoleDetails[];
  }>;
  updateRole(roleKey: string, input: UpdateRoleInput): Promise<AuthorizationRoleDetails>;
}

@Injectable()
export class AuthorizationRolesService {
  constructor(
    @Inject(AuthorizationRolesRepository)
    private readonly authorizationRolesRepository: AuthorizationRolesStore,
  ) {}

  async listRoleCatalog() {
    return this.authorizationRolesRepository.listRoleCatalog();
  }

  async createCustomRole(input: CreateCustomRoleInput): Promise<AuthorizationRoleDetails> {
    return this.authorizationRolesRepository.createCustomRole(input);
  }

  async updateRole(roleKey: string, input: UpdateRoleInput): Promise<AuthorizationRoleDetails> {
    return this.authorizationRolesRepository.updateRole(roleKey, input);
  }

  async deleteCustomRole(roleKey: string): Promise<void> {
    await this.authorizationRolesRepository.deleteCustomRole(roleKey);
  }
}
