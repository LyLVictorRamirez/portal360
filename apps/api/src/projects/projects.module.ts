import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { ProjectsController } from "./projects.controller.js";
import { PROJECTS_DATABASE, ProjectRepository } from "./projects.repository.js";
import { ProjectService } from "./projects.service.js";

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectRepository,
    ProjectService,
    {
      provide: PROJECTS_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class ProjectsModule {}
