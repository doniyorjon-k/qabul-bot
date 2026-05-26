import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PlansModule } from '../plans/plans.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';
import { SuperAdminBotModule } from '../super-admin/super-admin-bot.module';

@Module({
  imports: [PlansModule, ClinicsModule, ClinicBotsModule, SuperAdminBotModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
