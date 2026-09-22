import { Module } from "@nestjs/common";

import { authDatabasePool } from "../auth.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { TicketsController } from "./tickets.controller.js";
import { TICKETS_DATABASE, TicketRepository } from "./tickets.repository.js";
import { TicketService } from "./tickets.service.js";

@Module({
  controllers: [TicketsController],
  imports: [AuthorizationModule],
  providers: [
    TicketRepository,
    TicketService,
    {
      provide: TICKETS_DATABASE,
      useValue: authDatabasePool,
    },
  ],
})
export class TicketsModule {}
