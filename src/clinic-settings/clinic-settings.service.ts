import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClinicSettings } from '../database/entities/clinic-settings.entity';

@Injectable()
export class ClinicSettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(ClinicSettings)
    private readonly repo: Repository<ClinicSettings>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save(this.repo.create({
        name: this.configService.get<string>('clinic.name') || 'Smile Dental',
        address: this.configService.get<string>('clinic.address') || '',
        phone: this.configService.get<string>('clinic.phone') || '',
        telegram: this.configService.get<string>('clinic.telegram') || '',
        mapsUrl: this.configService.get<string>('clinic.mapsUrl') || '',
        tgUrl: 'https://t.me/dentist_nargiss',
        igUrl: 'https://www.instagram.com/dentist_nargiss',
      }));
    }
  }

  async get(): Promise<ClinicSettings> {
    const settings = await this.repo.findOne({ where: {} });
    return settings!;
  }

  async update(data: Partial<Omit<ClinicSettings, 'id'>>): Promise<void> {
    const settings = await this.get();
    await this.repo.update(settings.id, data);
  }
}
