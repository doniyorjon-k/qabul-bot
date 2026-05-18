import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AppointmentsModule } from '../appointments/appointments.module';

@Module({
  imports: [AppointmentsModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
