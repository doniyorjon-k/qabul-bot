import { Module } from '@nestjs/common';
import { AdminApiController } from './admin-api.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TimeSlotsModule } from '../time-slots/time-slots.module';
import { UsersModule } from '../users/users.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [AppointmentsModule, TimeSlotsModule, UsersModule, ReviewsModule],
  controllers: [AdminApiController],
})
export class AdminApiModule {}
