import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";

import { AppController } from "./app.controller.js";
import { ActivitiesModule } from "./activities/activities.module.js";
import { ActivityCategoriesModule } from "./activity-categories/activity-categories.module.js";
import { AuthorizationModule } from "./authorization/authorization.module.js";
import { auth } from "./auth.js";
import { ClientsModule } from "./clients/clients.module.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { RequirementsModule } from "./requirements/requirements.module.js";
import { TicketsModule } from "./tickets/tickets.module.js";

@Module({
  controllers: [AppController],
  imports: [
    AuthorizationModule,
    ActivitiesModule,
    ActivityCategoriesModule,
    ClientsModule,
    ProjectsModule,
    RequirementsModule,
    TicketsModule,
    AuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
    }),
  ],
})
export class AppModule {}
