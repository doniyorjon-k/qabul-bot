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
    const count = await this.repo.count();
    if (count === 0) {
      await this.repo.save([
        this.repo.create({ name: 'Oylik', slug: 'monthly', price: 150000, durationDays: 30, isActive: true }),
        this.repo.create({ name: 'Yillik', slug: 'yearly', price: 1500000, durationDays: 365, isActive: true }),
      ]);
    }
  }

  async findAll(): Promise<Plan[]> {
    return this.repo.find({ where: { isActive: true }, order: { durationDays: 'ASC' } });
  }

  async findById(id: number): Promise<Plan | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, data: Partial<Plan>): Promise<void> {
    await this.repo.update(id, data);
  }
}
