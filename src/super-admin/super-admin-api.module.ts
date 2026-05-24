import { Module } from '@nestjs/common';
import { SuperAdminApiController } from './super-admin-api.controller';
import { SuperAdminBotModule } from './super-admin-bot.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { PromosModule } from '../promos/promos.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';

@Module({
  imports: [SuperAdminBotModule, ClinicsModule, PaymentsModule, PlansModule, PromosModule, ClinicBotsModule],
  controllers: [SuperAdminApiController],
})
export class SuperAdminApiModule {}
