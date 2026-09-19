import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { ClientsController } from "./clients.controller.js";
import { CLIENTS_DATABASE, ClientRepository } from "./clients.repository.js";
import { ClientService } from "./clients.service.js";

@Module({
  controllers: [ClientsController],
  imports: [AuthorizationModule],
  providers: [
    ClientRepository,
    ClientService,
    {
      provide: CLIENTS_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class ClientsModule {}
