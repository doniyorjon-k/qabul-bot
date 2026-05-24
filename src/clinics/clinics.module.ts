import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../database/entities/clinic.entity';
import { WorkSchedule } from '../database/entities/work-schedule.entity';
import { ClinicSettings } from '../database/entities/clinic-settings.entity';
import { Service } from '../database/entities/service.entity';
import { Faq } from '../database/entities/faq.entity';
import { ClinicsService } from './clinics.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, WorkSchedule, ClinicSettings, Service, Faq])],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
