import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';
import { SuperAdminBotModule } from '../super-admin/super-admin-bot.module';

@Module({
  imports: [ClinicBotsModule, SuperAdminBotModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
