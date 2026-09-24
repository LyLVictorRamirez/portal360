import { Module } from "@nestjs/common";
import { authDatabasePool } from "../auth.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ActivitiesController } from "./activities.controller.js";
import { ACTIVITIES_DATABASE, ActivityRepository } from "./activities.repository.js";
import { ActivityService } from "./activities.service.js";

@Module({
  controllers: [ActivitiesController],
  imports: [AuthorizationModule],
  providers: [
    ActivityRepository,
    ActivityService,
    { provide: ACTIVITIES_DATABASE, useValue: authDatabasePool },
  ],
})
export class ActivitiesModule {}
