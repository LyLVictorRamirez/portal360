import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { RequirementsController } from "./requirements.controller.js";
import { REQUIREMENTS_DATABASE, RequirementRepository } from "./requirements.repository.js";
import { RequirementService } from "./requirements.service.js";

@Module({
  controllers: [RequirementsController],
  imports: [AuthorizationModule],
  providers: [
    RequirementRepository,
    RequirementService,
    {
      provide: REQUIREMENTS_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class RequirementsModule {}
