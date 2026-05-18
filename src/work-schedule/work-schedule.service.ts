import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkSchedule } from '../database/entities/work-schedule.entity';

@Injectable()
export class WorkScheduleService implements OnModuleInit {
  constructor(
    @InjectRepository(WorkSchedule)
    private readonly repo: Repository<WorkSchedule>,
  ) {}

  async onModuleInit() {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (!existing) {
      await this.repo.save(this.repo.create({
        workDays: [1, 2, 3, 4, 5, 6],
        workHours: [
          '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
          '12:00', '12:30', '14:00', '14:30', '15:00', '15:30',
          '16:00', '16:30', '17:00', '17:30',
        ],
        blockedDates: [],
        extraWorkDates: [],
      }));
    } else {
      const corrected = (existing.workDays || []).map(Number);
      if (!corrected.includes(2)) corrected.push(2);
      corrected.sort((a, b) => a - b);

      // Eski soatlik jadval bo'lsa yarim soatlikka o'tkazish
      const currentHours: string[] = existing.workHours || [];
      const hasHalfHours = currentHours.some((h) => h.endsWith(':30'));
      let newHours = currentHours;
      if (!hasHalfHours) {
        newHours = currentHours.flatMap((h) => {
          const [hr] = h.split(':');
          return [`${hr}:00`, `${hr}:30`];
        }).sort();
      }

      await this.repo.update(1, {
        workDays: corrected,
        workHours: newHours,
        blockedDates: existing.blockedDates || [],
        extraWorkDates: existing.extraWorkDates || [],
      });
    }
  }

  async get(): Promise<WorkSchedule> {
    return this.repo.findOne({ where: { id: 1 } });
  }

  // Sana ish kunimі yoki yo'qligini hisoblash
  async isWorkingDate(dateStr: string): Promise<boolean> {
    const schedule = await this.get();
    const workDays = (schedule.workDays || []).map(Number);
    const blocked = schedule.blockedDates || [];
    const extra = schedule.extraWorkDates || [];

    if (extra.includes(dateStr)) return true;
    if (blocked.includes(dateStr)) return false;
    const d = new Date(dateStr);
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    return workDays.includes(dow);
  }

  // Sanani toggle: ish kuni → dam olish, dam olish → ish kuni
  async toggleDate(dateStr: string): Promise<boolean> {
    const schedule = await this.get();
    const working = await this.isWorkingDate(dateStr);

    if (working) {
      await this.repo.update(1, {
        blockedDates: [...schedule.blockedDates, dateStr],
        extraWorkDates: schedule.extraWorkDates.filter((d) => d !== dateStr),
      });
      return false;
    } else {
      await this.repo.update(1, {
        blockedDates: schedule.blockedDates.filter((d) => d !== dateStr),
        extraWorkDates: [...schedule.extraWorkDates, dateStr],
      });
      return true;
    }
  }

  async saveWorkDays(days: number[]): Promise<void> {
    await this.repo.update(1, { workDays: days });
  }

  async saveWorkHours(hours: string[]): Promise<void> {
    await this.repo.update(1, { workHours: hours.sort() });
  }
}
