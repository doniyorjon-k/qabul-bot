import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlot } from '../database/entities/time-slot.entity';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

@Injectable()
export class TimeSlotsService implements OnModuleInit {
  constructor(
    @InjectRepository(TimeSlot)
    private readonly slotsRepo: Repository<TimeSlot>,
    private readonly workScheduleService: WorkScheduleService,
  ) {}

  async onModuleInit() {
    await this.removeDuplicateSlots();
    await this.regenerateFutureSlots();
  }

  private async removeDuplicateSlots(): Promise<void> {
    const slots = await this.slotsRepo.find({ order: { date: 'ASC', time: 'ASC' } });

    const seen = new Map<string, TimeSlot>();
    const toDelete: number[] = [];

    for (const slot of slots) {
      const key = `${slot.date}|${slot.time}`; // transformer already normalizes to HH:MM
      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, slot);
      } else if (slot.isBooked && !existing.isBooked) {
        toDelete.push(existing.id);
        seen.set(key, slot);
      } else {
        toDelete.push(slot.id);
      }
    }

    if (toDelete.length > 0) {
      await this.slotsRepo.delete(toDelete);
    }
  }

  async getAvailableSlots(date: string): Promise<TimeSlot[]> {
    await this.ensureSlotsForDate(date);
    return this.slotsRepo.find({
      where: { date, isBooked: false },
      order: { time: 'ASC' },
    });
  }

  async getAllSlotsForDate(date: string): Promise<TimeSlot[]> {
    await this.ensureSlotsForDate(date);
    return this.slotsRepo.find({
      where: { date },
      order: { time: 'ASC' },
    });
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

  // Jadval o'zgarganda kelajakdagi bo'sh slotlarni qayta yaratish
  async regenerateFutureSlots(): Promise<void> {
    const schedule = await this.workScheduleService.get();
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dow = date.getDay() === 0 ? 7 : date.getDay(); // 1=Du ... 7=Ya
      const dateStr = toDateStr(date);

      if (!schedule.workDays.includes(dow)) {
        // Dam olish kuni — band bo'lmagan slotlarni o'chirish
        await this.slotsRepo.delete({ date: dateStr, isBooked: false });
        continue;
      }

      const existing = await this.slotsRepo.find({ where: { date: dateStr } });
      const existingTimes = existing.map((s) => s.time);

      // Yangi soatlarni qo'shish
      for (const time of schedule.workHours) {
        if (!existingTimes.includes(time)) {
          await this.slotsRepo.save(this.slotsRepo.create({ date: dateStr, time, isBooked: false }));
        }
      }

      // Ish vaqtidan chiqqan bo'sh slotlarni o'chirish
      for (const slot of existing) {
        if (!schedule.workHours.includes(slot.time) && !slot.isBooked) {
          await this.slotsRepo.delete(slot.id);
        }
      }
    }
  }

  private async ensureSlotsForDate(date: string): Promise<void> {
    const existing = await this.slotsRepo.count({ where: { date } });
    if (existing > 0) return;

    const isWorking = await this.workScheduleService.isWorkingDate(date);
    if (!isWorking) return;

    const schedule = await this.workScheduleService.get();
    const slots = schedule.workHours.map((time) =>
      this.slotsRepo.create({ date, time, isBooked: false }),
    );
    await this.slotsRepo.save(slots);
  }
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
