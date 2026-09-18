import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationController } from "./authorization.controller.js";
import { AuthorizationContextService } from "./authorization-context.service.js";
import { AuthorizationGuard } from "./authorization.guard.js";
import { AUTHORIZATION_DATABASE, AuthorizationRepository } from "./authorization.repository.js";
import { AuthorizationService } from "./authorization.service.js";
import { AuthorizationUsersController } from "./authorization-users.controller.js";
import { AuthorizationUsersRepository } from "./authorization-users.repository.js";
import { AuthorizationUsersService } from "./authorization-users.service.js";

@Module({
  controllers: [AuthorizationController, AuthorizationUsersController],
  exports: [AuthorizationContextService, AuthorizationGuard, AuthorizationService],
  providers: [
    AuthorizationContextService,
    AuthorizationGuard,
    AuthorizationRepository,
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
