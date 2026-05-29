import { Controller, Get } from "@nestjs/common";

/** Health check — must work even without Clerk keys, so it lives outside auth. */
@Controller("api")
export class HealthController {
  @Get("health")
  health(): { ok: true } {
    return { ok: true };
  }
}
