import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkSchedule } from '../database/entities/work-schedule.entity';
import { WorkScheduleService } from './work-schedule.service';

@Module({
  imports: [TypeOrmModule.forFeature([WorkSchedule])],
  providers: [WorkScheduleService],
  exports: [WorkScheduleService],
})
export class WorkScheduleModule {}
