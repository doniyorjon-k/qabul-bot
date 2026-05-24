import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlot } from '../database/entities/time-slot.entity';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable()
export class TimeSlotsService {
  constructor(
    @InjectRepository(TimeSlot)
    private readonly slotsRepo: Repository<TimeSlot>,
    private readonly workScheduleService: WorkScheduleService,
  ) {}

  async getAvailableSlots(clinicId: number, date: string): Promise<TimeSlot[]> {
    await this.ensureSlotsForDate(clinicId, date);
    return this.slotsRepo.find({ where: { clinic: { id: clinicId }, date, isBooked: false }, order: { time: 'ASC' } });
  }

  async getAllSlotsForDate(clinicId: number, date: string): Promise<TimeSlot[]> {
    await this.ensureSlotsForDate(clinicId, date);
    return this.slotsRepo.find({ where: { clinic: { id: clinicId }, date }, order: { time: 'ASC' } });
  }

  async findById(id: number): Promise<TimeSlot | null> {
    return this.slotsRepo.findOne({ where: { id } });
  }

  async bookSlot(id: number): Promise<void> {
    await this.slotsRepo.update(id, { isBooked: true });
  }

  async freeSlot(id: number): Promise<void> {
    await this.slotsRepo.update(id, { isBooked: false });
  }

  async regenerateFutureSlots(clinicId: number): Promise<void> {
    const schedule = await this.workScheduleService.get(clinicId);
    if (!schedule) return;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dow = date.getDay() === 0 ? 7 : date.getDay();
      const dateStr = toDateStr(date);

      if (!schedule.workDays.includes(dow)) {
        await this.slotsRepo.delete({ clinic: { id: clinicId }, date: dateStr, isBooked: false });
        continue;
      }

      const existing = await this.slotsRepo.find({ where: { clinic: { id: clinicId }, date: dateStr } });
      const existingTimes = existing.map((s) => s.time);

      for (const time of schedule.workHours) {
        if (!existingTimes.includes(time)) {
          await this.slotsRepo.save(this.slotsRepo.create({ clinic: { id: clinicId } as any, date: dateStr, time, isBooked: false }));
        }
      }

      for (const slot of existing) {
        if (!schedule.workHours.includes(slot.time) && !slot.isBooked) {
          await this.slotsRepo.delete(slot.id);
        }
      }
    }
  }

  private async ensureSlotsForDate(clinicId: number, date: string): Promise<void> {
    const existing = await this.slotsRepo.count({ where: { clinic: { id: clinicId }, date } });
    if (existing > 0) return;

    const isWorking = await this.workScheduleService.isWorkingDate(clinicId, date);
    if (!isWorking) return;

    const schedule = await this.workScheduleService.get(clinicId);
    const slots = schedule.workHours.map((time) =>
      this.slotsRepo.create({ clinic: { id: clinicId } as any, date, time, isBooked: false }),
    );
    await this.slotsRepo.save(slots);
  }
}
