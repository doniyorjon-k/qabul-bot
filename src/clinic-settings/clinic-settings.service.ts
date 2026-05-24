import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicSettings } from '../database/entities/clinic-settings.entity';

@Injectable()
export class ClinicSettingsService {
  constructor(
    @InjectRepository(ClinicSettings)
    private readonly repo: Repository<ClinicSettings>,
  ) {}

  async get(clinicId: number): Promise<ClinicSettings> {
    return this.repo.findOne({ where: { clinic: { id: clinicId } } });
  }

  async update(clinicId: number, data: Partial<Omit<ClinicSettings, 'id' | 'clinic'>>): Promise<void> {
    const settings = await this.get(clinicId);
    if (settings) await this.repo.update(settings.id, data);
  }
}
