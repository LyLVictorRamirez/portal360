import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";

import { AuthorizationGuard } from "./authorization.guard.js";
import { AuthorizationContext } from "./authorization-context.decorator.js";
import {
  AuthorizationRoleAssignmentError,
  AuthorizationUserNotFoundError,
} from "./authorization-users.repository.js";
import { AuthorizationUsersService } from "./authorization-users.service.js";
import { RequirePermissions } from "./require-permissions.decorator.js";
import type {
  AuthorizationRequestContext,
  AuthorizationRole,
  AuthorizationUser,
} from "./authorization.types.js";

@Controller("api/authorization/users")
@UseGuards(AuthorizationGuard)
export class AuthorizationUsersController {
  constructor(
    @Inject(AuthorizationUsersService)
    private readonly authorizationUsersService: AuthorizationUsersService,
  ) {}

  @Get()
  @RequirePermissions("authorization.users.read")
  async listUsers(
    @Query("query") query: string | undefined,
  ): Promise<{ users: AuthorizationUser[] }> {
    return { users: await this.authorizationUsersService.listUsers(query) };
  }

  @Put(":userId/roles")
  @RequirePermissions("authorization.users.manage")
  async replaceUserRoles(
    @Param("userId") userId: string,
    @Body() body: unknown,
    @AuthorizationContext() context: AuthorizationRequestContext,
  ): Promise<{ roles: AuthorizationRole[] }> {
    try {
      return {
        roles: await this.authorizationUsersService.replaceUserRoles(
          userId,
          readRoleKeys(body),
          context.userId,
        ),
      };
    } catch (error) {
      if (error instanceof AuthorizationUserNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof AuthorizationRoleAssignmentError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }
}

function readRoleKeys(body: unknown): string[] {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("The request body must contain roleKeys.");
  }

  const roleKeys = (body as { roleKeys?: unknown }).roleKeys;

  if (!Array.isArray(roleKeys) || roleKeys.some((roleKey) => typeof roleKey !== "string")) {
    throw new BadRequestException("roleKeys must be an array of role keys.");
  }

  const normalizedRoleKeys = roleKeys.map((roleKey) => roleKey.trim());

  if (normalizedRoleKeys.some((roleKey) => !roleKey)) {
    throw new BadRequestException("roleKeys cannot contain empty values.");
  }

  return normalizedRoleKeys;
}
