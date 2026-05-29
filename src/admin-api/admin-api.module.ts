import { Module } from '@nestjs/common';
import { AdminApiController } from './admin-api.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TimeSlotsModule } from '../time-slots/time-slots.module';
import { UsersModule } from '../users/users.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';
import { ClinicSettingsModule } from '../clinic-settings/clinic-settings.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [
    AppointmentsModule, TimeSlotsModule, UsersModule, ReviewsModule,
    WorkScheduleModule, ClinicSettingsModule, ClinicsModule, ClinicBotsModule, PlansModule,
  ],
  controllers: [AdminApiController],
})
export class AdminApiModule {}
