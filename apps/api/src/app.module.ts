import { Module } from "@nestjs/common";
import { AuthModule } from "@thallesp/nestjs-better-auth";

import { AppController } from "./app.controller.js";
import { auth } from "./auth.js";

@Module({
  controllers: [AppController],
  imports: [
    AuthModule.forRoot({
      auth,
      disableGlobalAuthGuard: true,
    }),
  ],
})
export class AppModule {}
