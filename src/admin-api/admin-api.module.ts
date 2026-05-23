import { Module } from '@nestjs/common';
import { AdminApiController } from './admin-api.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
import { TimeSlotsModule } from '../time-slots/time-slots.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [AppointmentsModule, TimeSlotsModule, UsersModule],
  controllers: [AdminApiController],
})
export class AdminApiModule {}
