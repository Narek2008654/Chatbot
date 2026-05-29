import { Body, Controller, HttpCode, Inject, Post, Query, UnauthorizedException } from "@nestjs/common";
import { env } from "../env.js";
import type { AiClient } from "../ai/client.js";
import type { TwilioClient } from "../twilio/client.js";
import { handleCallEnded } from "../routes/webhook.js";
import { AI_CLIENT, TWILIO_CLIENT } from "./tokens.js";

/**
 * POST /api/retell/webhook — Retell posts call lifecycle events here. NOT
 * Clerk-authenticated (Retell isn't a user); guarded by an optional shared
 * secret in the query string. Always ACKs 2xx so Retell never retries.
 */
@Controller("api/retell/webhook")
export class WebhookController {
  constructor(
    @Inject(AI_CLIENT) private readonly ai: AiClient,
    @Inject(TWILIO_CLIENT) private readonly twilio: TwilioClient,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(@Query("secret") secret: string | undefined, @Body() body: unknown) {
    if (env.RETELL_WEBHOOK_SECRET && secret !== env.RETELL_WEBHOOK_SECRET) {
      throw new UnauthorizedException();
    }
    try {
      await handleCallEnded(this.ai, this.twilio, body);
    } catch {
      // best-effort: swallow and still acknowledge so Retell doesn't retry
    }
    return { ok: true };
  }
}
