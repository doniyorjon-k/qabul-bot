import { Controller, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';

@Controller('webhook')
export class WebhookController {
  constructor(private readonly clinicBotsService: ClinicBotsService) {}

  @Post(':clinicId')
  async handleWebhook(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() update: any,
  ) {
    await this.clinicBotsService.handleWebhook(clinicId, update);
    return { ok: true };
  }
}
