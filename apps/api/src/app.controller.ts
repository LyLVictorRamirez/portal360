import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  getStatus() {
    return { name: "Portal 360 API", status: "ok" };
  }
}
