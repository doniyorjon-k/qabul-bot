import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkSchedule } from '../database/entities/work-schedule.entity';

@Injectable()
export class WorkScheduleService {
  constructor(
    @InjectRepository(WorkSchedule)
    private readonly repo: Repository<WorkSchedule>,
  ) {}

  async get(clinicId: number): Promise<WorkSchedule> {
    return this.repo.findOne({ where: { clinic: { id: clinicId } } });
  }

  async isWorkingDate(clinicId: number, dateStr: string): Promise<boolean> {
    const schedule = await this.get(clinicId);
    if (!schedule) return false;
    const workDays = (schedule.workDays || []).map(Number);
    const blocked = schedule.blockedDates || [];
    const extra = schedule.extraWorkDates || [];

    if (extra.includes(dateStr)) return true;
    if (blocked.includes(dateStr)) return false;
    const d = new Date(dateStr);
    const dow = d.getDay() === 0 ? 7 : d.getDay();
    return workDays.includes(dow);
  }

  async toggleDate(clinicId: number, dateStr: string): Promise<boolean> {
    const schedule = await this.get(clinicId);
    const working = await this.isWorkingDate(clinicId, dateStr);

    if (working) {
      await this.repo.update(schedule.id, {
        blockedDates: [...schedule.blockedDates, dateStr],
        extraWorkDates: schedule.extraWorkDates.filter((d) => d !== dateStr),
      });
      return false;
    } else {
      await this.repo.update(schedule.id, {
        blockedDates: schedule.blockedDates.filter((d) => d !== dateStr),
        extraWorkDates: [...schedule.extraWorkDates, dateStr],
      });
      return true;
    }
  }

  async saveWorkDays(clinicId: number, days: number[]): Promise<void> {
    const schedule = await this.get(clinicId);
    await this.repo.update(schedule.id, { workDays: days });
  }

  async saveWorkHours(clinicId: number, hours: string[]): Promise<void> {
    const schedule = await this.get(clinicId);
    await this.repo.update(schedule.id, { workHours: hours.sort() });
  }
}
