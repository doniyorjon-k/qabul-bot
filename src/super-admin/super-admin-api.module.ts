import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminApiController } from './super-admin-api.controller';
import { SuperAdminBotModule } from './super-admin-bot.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { PromosModule } from '../promos/promos.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';
import { Broadcast } from '../database/entities/broadcast.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Broadcast]), SuperAdminBotModule, ClinicsModule, PaymentsModule, PlansModule, PromosModule, ClinicBotsModule],
  controllers: [SuperAdminApiController],
})
export class SuperAdminApiModule {}
