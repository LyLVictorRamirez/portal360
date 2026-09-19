import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";

import { AuthorizationGuard } from "./authorization.guard.js";
import { AuthorizationContext } from "./authorization-context.decorator.js";
import {
  AuthorizationRoleMutationError,
  AuthorizationRoleNotFoundError,
  type CreateCustomRoleInput,
  type UpdateRoleInput,
} from "./authorization-roles.repository.js";
import { AuthorizationRolesService } from "./authorization-roles.service.js";
import { isAuthorizationPermission, type AuthorizationPermission } from "./permissions.js";
import { RequirePermissions } from "./require-permissions.decorator.js";
import type {
  AuthorizationRequestContext,
  AuthorizationRoleDetails,
} from "./authorization.types.js";

@Controller("api/authorization/roles")
@UseGuards(AuthorizationGuard)
export class AuthorizationRolesController {
  constructor(
    @Inject(AuthorizationRolesService)
    private readonly authorizationRolesService: AuthorizationRolesService,
  ) {}

  @Get()
  @RequirePermissions("authorization.roles.read")
  async listRoleCatalog() {
    return this.authorizationRolesService.listRoleCatalog();
  }

  @Post()
  @RequirePermissions("authorization.roles.manage")
  async createCustomRole(
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ role: AuthorizationRoleDetails }> {
    try {
      return {
        role: await this.authorizationRolesService.createCustomRole(
          readCreateRoleInput(body),
          context.userId,
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Patch(":roleKey")
  @RequirePermissions("authorization.roles.manage")
  async updateRole(
    @Param("roleKey") roleKey: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ role: AuthorizationRoleDetails }> {
    try {
      return {
        role: await this.authorizationRolesService.updateRole(
          roleKey,
          readUpdateRoleInput(body),
          context.userId,
        ),
      };
    } catch (error) {
      throw toHttpException(error);
    }
  }

  @Delete(":roleKey")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("authorization.roles.manage")
  async deleteCustomRole(
    @Param("roleKey") roleKey: string,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<void> {
    try {
      await this.authorizationRolesService.deleteCustomRole(roleKey, context.userId);
    } catch (error) {
      throw toHttpException(error);
    }
  }
}

function readCreateRoleInput(body: unknown): CreateCustomRoleInput {
  const record = readRecord(body);

  return {
    description: readNonEmptyString(record.description, "description"),
    key: readRoleKey(record.key),
    name: readNonEmptyString(record.name, "name"),
    permissionKeys: readPermissionKeys(record.permissionKeys),
  };
}

function readUpdateRoleInput(body: unknown): UpdateRoleInput {
  const record = readRecord(body);
  const isActive = record.isActive;

  if (isActive !== undefined && typeof isActive !== "boolean") {
    throw new BadRequestException("isActive must be a boolean when provided.");
  }

  return {
    description: readNonEmptyString(record.description, "description"),
    isActive,
    name: readNonEmptyString(record.name, "name"),
    permissionKeys: readPermissionKeys(record.permissionKeys),
  };
}

function readPermissionKeys(value: unknown): AuthorizationPermission[] {
  if (!Array.isArray(value) || value.some((permissionKey) => typeof permissionKey !== "string")) {
    throw new BadRequestException("permissionKeys must be an array of known permission keys.");
  }

  const permissionKeys = value.map((permissionKey) => permissionKey.trim());

  if (permissionKeys.some((permissionKey) => !isAuthorizationPermission(permissionKey))) {
    throw new BadRequestException("permissionKeys must belong to the fixed permission catalog.");
  }

  return permissionKeys;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("The request body must be an object.");
  }

  return value as Record<string, unknown>;
}

function readNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required.`);
  }

  return value.trim();
}

function readRoleKey(value: unknown): string {
  const key = readNonEmptyString(value, "key");

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
    throw new BadRequestException("key must use lowercase letters, numbers and hyphens.");
  }

  return key;
}

function toHttpException(error: unknown): Error {
  if (error instanceof AuthorizationRoleNotFoundError) {
    return new NotFoundException(error.message);
  }

  if (error instanceof AuthorizationRoleMutationError) {
    return new ConflictException(error.message);
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Authorization role operation failed.");
}
