import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';

@Module({
  imports: [ClinicBotsModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
