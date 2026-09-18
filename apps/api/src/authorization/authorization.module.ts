import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AUTHORIZATION_DATABASE, AuthorizationRepository } from "./authorization.repository.js";
import { AuthorizationService } from "./authorization.service.js";

@Module({
  exports: [AuthorizationService],
  providers: [
    AuthorizationRepository,
    AuthorizationService,
    {
      provide: AUTHORIZATION_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class AuthorizationModule {}
