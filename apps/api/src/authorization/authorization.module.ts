import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationController } from "./authorization.controller.js";
import { AuthorizationContextService } from "./authorization-context.service.js";
import { AuthorizationGuard } from "./authorization.guard.js";
import { AUTHORIZATION_DATABASE, AuthorizationRepository } from "./authorization.repository.js";
import { AuthorizationRolesController } from "./authorization-roles.controller.js";
import { AuthorizationRolesRepository } from "./authorization-roles.repository.js";
import { AuthorizationRolesService } from "./authorization-roles.service.js";
import { AuthorizationService } from "./authorization.service.js";
import { AuthorizationUsersController } from "./authorization-users.controller.js";
import { AuthorizationUsersRepository } from "./authorization-users.repository.js";
import { AuthorizationUsersService } from "./authorization-users.service.js";

@Module({
  controllers: [
    AuthorizationController,
    AuthorizationRolesController,
    AuthorizationUsersController,
  ],
  exports: [AuthorizationContextService, AuthorizationGuard, AuthorizationService],
  providers: [
    AuthorizationContextService,
    AuthorizationGuard,
    AuthorizationRepository,
    AuthorizationRolesRepository,
    AuthorizationRolesService,
    AuthorizationService,
    AuthorizationUsersRepository,
    AuthorizationUsersService,
    {
      provide: AUTHORIZATION_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class AuthorizationModule {}
