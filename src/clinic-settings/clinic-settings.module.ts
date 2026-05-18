import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicSettings } from '../database/entities/clinic-settings.entity';
import { ClinicSettingsService } from './clinic-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClinicSettings])],
  providers: [ClinicSettingsService],
  exports: [ClinicSettingsService],
})
export class ClinicSettingsModule {}
