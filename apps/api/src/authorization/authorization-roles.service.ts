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
  createCustomRole(
    input: CreateCustomRoleInput,
    actorUserId: string | null,
  ): Promise<AuthorizationRoleDetails>;
  deleteCustomRole(roleKey: string, actorUserId: string | null): Promise<void>;
  listRoleCatalog(): Promise<{
    permissions: AuthorizationPermissionDefinition[];
    roles: AuthorizationRoleDetails[];
  }>;
  updateRole(
    roleKey: string,
    input: UpdateRoleInput,
    actorUserId: string | null,
  ): Promise<AuthorizationRoleDetails>;
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

  async createCustomRole(
    input: CreateCustomRoleInput,
    actorUserId: string | null = null,
  ): Promise<AuthorizationRoleDetails> {
    return this.authorizationRolesRepository.createCustomRole(input, actorUserId);
  }

  async updateRole(
    roleKey: string,
    input: UpdateRoleInput,
    actorUserId: string | null = null,
  ): Promise<AuthorizationRoleDetails> {
    return this.authorizationRolesRepository.updateRole(roleKey, input, actorUserId);
  }

  async deleteCustomRole(roleKey: string, actorUserId: string | null = null): Promise<void> {
    await this.authorizationRolesRepository.deleteCustomRole(roleKey, actorUserId);
  }
}
