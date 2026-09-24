import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ActivityCategoriesController } from "./activity-categories.controller.js";
import {
  ACTIVITY_CATEGORIES_DATABASE,
  ActivityCategoryRepository,
} from "./activity-categories.repository.js";
import { ActivityCategoryService } from "./activity-categories.service.js";

@Module({
  controllers: [ActivityCategoriesController],
  imports: [AuthorizationModule],
  providers: [
    ActivityCategoryRepository,
    ActivityCategoryService,
    {
      provide: ACTIVITY_CATEGORIES_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class ActivityCategoriesModule {}
