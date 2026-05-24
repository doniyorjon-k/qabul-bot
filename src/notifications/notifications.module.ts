import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ClinicBotsModule } from '../clinic-bots/clinic-bots.module';

@Module({
  imports: [AppointmentsModule, ClinicsModule, ClinicBotsModule],
  providers: [NotificationsService],
})
export class NotificationsModule {}
