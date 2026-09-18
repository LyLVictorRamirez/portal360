import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationController } from "./authorization.controller.js";
import { AuthorizationContextService } from "./authorization-context.service.js";
import { AuthorizationGuard } from "./authorization.guard.js";
import { AUTHORIZATION_DATABASE, AuthorizationRepository } from "./authorization.repository.js";
import { AuthorizationService } from "./authorization.service.js";

@Module({
  controllers: [AuthorizationController],
  exports: [AuthorizationContextService, AuthorizationGuard, AuthorizationService],
  providers: [
    AuthorizationContextService,
    AuthorizationGuard,
    AuthorizationRepository,
    AuthorizationService,
    {
      provide: AUTHORIZATION_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class AuthorizationModule {}
