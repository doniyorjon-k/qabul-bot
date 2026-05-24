import { Module } from '@nestjs/common';
import { SuperAdminBotService } from './super-admin-bot.service';
import { ClinicsModule } from '../clinics/clinics.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { PromosModule } from '../promos/promos.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';

@Module({
  imports: [ClinicsModule, PaymentsModule, PlansModule, PromosModule, ClinicBotsModule],
  providers: [SuperAdminBotService],
  exports: [SuperAdminBotService],
})
export class SuperAdminBotModule {}
