import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from '../database/entities/plan.entity';

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(
    @InjectRepository(Plan) private readonly repo: Repository<Plan>,
  ) {}

  async onModuleInit() {
    const defaults = [
      { name: 'Oylik', slug: 'monthly', price: 149000, durationDays: 30, isActive: true, isMostPopular: false, bonus: null },
      { name: 'Yarim yillik', slug: 'semi-yearly', price: 699000, durationDays: 180, isActive: true, isMostPopular: true, bonus: 'Landing page bepul' },
      { name: 'Yillik', slug: 'yearly', price: 1190000, durationDays: 365, isActive: true, isMostPopular: false, bonus: 'Landing page bepul' },
    ];
    for (const d of defaults) {
      const existing = await this.repo.findOne({ where: { slug: d.slug } });
      if (!existing) {
        await this.repo.save(this.repo.create(d));
      }
    }
  }

  async findAll(): Promise<Plan[]> {
    return this.repo.find({ where: { isActive: true }, order: { durationDays: 'ASC' } });
  }

  async findAllIncludeInactive(): Promise<Plan[]> {
    return this.repo.find({ order: { durationDays: 'ASC' } });
  }

  async findById(id: number): Promise<Plan | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(data: Partial<Plan>): Promise<Plan> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Plan>): Promise<void> {
    await this.repo.update(id, data);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
