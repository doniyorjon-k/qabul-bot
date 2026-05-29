import { Module } from '@nestjs/common';
import { ClinicBotsService } from './clinic-bots.service';
import { ClinicsModule } from '../clinics/clinics.module';
import { UsersModule } from '../users/users.module';
import { ServicesModule } from '../services/services.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TimeSlotsModule } from '../time-slots/time-slots.module';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';
import { FaqModule } from '../faq/faq.module';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { PaymentsModule } from '../payments/payments.module';
import { PlansModule } from '../plans/plans.module';
import { PromosModule } from '../promos/promos.module';

@Module({
  imports: [
    ClinicsModule,
    UsersModule,
    ServicesModule,
    AppointmentsModule,
    TimeSlotsModule,
    WorkScheduleModule,
    FaqModule,
    ClinicSettingsModule,
    ReviewsModule,
    PaymentsModule,
    PlansModule,
    PromosModule,
  ],
  providers: [ClinicBotsService],
  exports: [ClinicBotsService],
})
export class ClinicBotsModule {}
