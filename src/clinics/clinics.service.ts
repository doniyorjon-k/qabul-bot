import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic, ClinicStatus } from '../database/entities/clinic.entity';
import { WorkSchedule } from '../database/entities/work-schedule.entity';
import { ClinicSettings } from '../database/entities/clinic-settings.entity';
import { Service } from '../database/entities/service.entity';
import { Faq } from '../database/entities/faq.entity';

const TRIAL_DAYS = 14;
const GRACE_DAYS = 3;

@Injectable()
export class ClinicsService implements OnModuleInit {
  constructor(
    @InjectRepository(Clinic) private readonly repo: Repository<Clinic>,
    @InjectRepository(WorkSchedule) private readonly scheduleRepo: Repository<WorkSchedule>,
    @InjectRepository(ClinicSettings) private readonly settingsRepo: Repository<ClinicSettings>,
    @InjectRepository(Service) private readonly servicesRepo: Repository<Service>,
    @InjectRepository(Faq) private readonly faqRepo: Repository<Faq>,
  ) {}

  async onModuleInit() {
    await this.seedDefaultClinicIfNeeded();
  }

  // Eski deployment dan migration: agar clinics jadvali bo'sh bo'lsa va
  // default klinika uchun bot token mavjud bo'lsa — seed qilinadi
  private async seedDefaultClinicIfNeeded() {
    const count = await this.repo.count();
    if (count > 0) return;

    const defaultToken = process.env.BOT_TOKEN;
    if (!defaultToken) return;

    const adminIds = (process.env.ADMIN_IDS || '').split(',').map(Number).filter(Boolean);
    await this.create({
      name: process.env.CLINIC_NAME || 'Smile Dental',
      botToken: defaultToken,
      adminIds,
      status: ClinicStatus.ACTIVE,
      subscriptionEndsAt: null,
      trialEndsAt: null,
    });
  }

  async create(data: {
    name: string;
    botToken: string;
    adminIds: number[];
    status?: ClinicStatus;
    trialEndsAt?: Date | null;
    subscriptionEndsAt?: Date | null;
  }): Promise<Clinic> {
    const trialEndsAt = data.trialEndsAt !== undefined
      ? data.trialEndsAt
      : new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const clinic = await this.repo.save(this.repo.create({
      name: data.name,
      botToken: data.botToken,
      adminIds: data.adminIds,
      status: data.status ?? ClinicStatus.TRIAL,
      trialEndsAt,
      subscriptionEndsAt: data.subscriptionEndsAt ?? null,
    }));

    await this.seedDefaults(clinic);
    return clinic;
  }

  private async seedDefaults(clinic: Clinic) {
    await this.scheduleRepo.save(this.scheduleRepo.create({
      clinic,
      workDays: [1, 2, 3, 4, 5, 6],
      workHours: ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'],
      blockedDates: [],
      extraWorkDates: [],
    }));

    await this.settingsRepo.save(this.settingsRepo.create({
      clinic,
      name: clinic.name,
      address: '',
      phone: '',
      telegram: '',
      mapsUrl: '',
      tgUrl: '',
      igUrl: '',
    }));

    const defaultServices = [
      { name: 'Tish tekshiruvi', emoji: '🦷', price: 'Bepul', sortOrder: 1 },
      { name: 'Tish plombasi', emoji: '🔧', price: "50 000 so'm dan", sortOrder: 2 },
      { name: 'Tish tozalash', emoji: '✨', price: "80 000 so'm dan", sortOrder: 3 },
      { name: 'Tish oqlash', emoji: '⚡', price: "150 000 so'm dan", sortOrder: 4 },
    ];
    for (const s of defaultServices) {
      await this.servicesRepo.save(this.servicesRepo.create({ ...s, clinic, isActive: true }));
    }
  }

  async findAll(): Promise<Clinic[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: number): Promise<Clinic | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByBotToken(token: string): Promise<Clinic | null> {
    return this.repo.findOne({ where: { botToken: token } });
  }

  async findActive(): Promise<Clinic[]> {
    return this.repo.find({
      where: [
        { status: ClinicStatus.TRIAL },
        { status: ClinicStatus.ACTIVE },
        { status: ClinicStatus.GRACE },
      ],
    });
  }

  async update(id: number, data: Partial<Clinic>): Promise<void> {
    await this.repo.update(id, data);
  }

  async updateAdminIds(id: number, adminIds: number[]): Promise<void> {
    await this.repo.update(id, { adminIds });
  }

  async addDays(id: number, days: number, planName?: string): Promise<Clinic> {
    const clinic = await this.repo.findOne({ where: { id } });
    const base = clinic.subscriptionEndsAt && clinic.subscriptionEndsAt > new Date()
      ? clinic.subscriptionEndsAt
      : new Date();
    const subscriptionEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await this.repo.update(id, {
      status: ClinicStatus.ACTIVE,
      subscriptionEndsAt,
      notified7Days: false,
      notified3Days: false,
      notified1Day: false,
      ...(planName ? { currentPlan: planName } : {}),
    });
    return this.repo.findOne({ where: { id } });
  }

  async setUnlimited(id: number): Promise<void> {
    await this.repo.update(id, {
      status: ClinicStatus.ACTIVE,
      subscriptionEndsAt: null,
      trialEndsAt: null,
      notified7Days: false,
      notified3Days: false,
      notified1Day: false,
    });
  }

  async suspend(id: number): Promise<void> {
    await this.repo.update(id, { status: ClinicStatus.SUSPENDED });
  }

  async activate(id: number): Promise<void> {
    await this.repo.update(id, { status: ClinicStatus.ACTIVE });
  }

  async extendTrial(id: number, days: number): Promise<void> {
    const clinic = await this.repo.findOne({ where: { id } });
    const base = clinic.trialEndsAt && clinic.trialEndsAt > new Date()
      ? clinic.trialEndsAt
      : new Date();
    await this.repo.update(id, {
      trialEndsAt: new Date(base.getTime() + days * 24 * 60 * 60 * 1000),
      status: ClinicStatus.TRIAL,
    });
  }

  // Subscription muddati tugagan klinikalarni topish
  async findExpiredForProcessing(): Promise<Clinic[]> {
    const all = await this.repo.find({
      where: [
        { status: ClinicStatus.TRIAL },
        { status: ClinicStatus.ACTIVE },
        { status: ClinicStatus.GRACE },
      ],
    });
    const now = new Date();
    return all.filter(c => {
      if (!c.trialEndsAt && !c.subscriptionEndsAt) return false; // unlimited
      const endsAt = c.subscriptionEndsAt ?? c.trialEndsAt;
      return endsAt < now;
    });
  }

  async getStats(): Promise<Record<string, number>> {
    const all = await this.repo.find();
    const counts: Record<string, number> = { total: all.length };
    for (const s of Object.values(ClinicStatus)) {
      counts[s] = all.filter(c => c.status === s).length;
    }
    return counts;
  }

  isEffectivelyActive(clinic: Clinic): boolean {
    if (clinic.status === ClinicStatus.SUSPENDED || clinic.status === ClinicStatus.EXPIRED) return false;
    if (!clinic.trialEndsAt && !clinic.subscriptionEndsAt) return true; // unlimited
    const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
    const graceEnd = new Date(endsAt.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000);
    return graceEnd > new Date();
  }
}
