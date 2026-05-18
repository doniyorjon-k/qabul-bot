import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeSlot } from '../database/entities/time-slot.entity';
import { TimeSlotsService } from './time-slots.service';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';

@Module({
  imports: [TypeOrmModule.forFeature([TimeSlot]), WorkScheduleModule],
  providers: [TimeSlotsService],
  exports: [TimeSlotsService],
})
export class TimeSlotsModule {}
