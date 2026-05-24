import { Controller, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { SuperAdminBotService } from '../super-admin/super-admin-bot.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly clinicBotsService: ClinicBotsService,
    private readonly superAdminBotService: SuperAdminBotService,
  ) {}

  @Post('super-admin')
  async handleSuperAdminWebhook(@Body() update: any) {
    await this.superAdminBotService.handleWebhook(update);
    return { ok: true };
  }

  @Post(':clinicId')
  async handleWebhook(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() update: any,
  ) {
    await this.clinicBotsService.handleWebhook(clinicId, update);
    return { ok: true };
  }
}
