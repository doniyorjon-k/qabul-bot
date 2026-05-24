import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promo } from '../database/entities/promo.entity';

@Injectable()
export class PromosService {
  constructor(
    @InjectRepository(Promo) private readonly repo: Repository<Promo>,
  ) {}

  async findAll(): Promise<Promo[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findActive(): Promise<Promo | null> {
    const today = new Date().toISOString().split('T')[0];
    const promos = await this.repo.find({ where: { isActive: true } });
    return promos.find(p => p.validFrom <= today && p.validTo >= today) ?? null;
  }

  async create(data: Partial<Promo>): Promise<Promo> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Promo>): Promise<void> {
    await this.repo.update(id, data);
  }

  async delete(id: number): Promise<void> {
    await this.repo.delete(id);
  }

  async findUnnotified(): Promise<Promo[]> {
    const today = new Date().toISOString().split('T')[0];
    const promos = await this.repo.find({ where: { isActive: true, notificationSent: false } });
    return promos.filter(p => p.validFrom <= today && p.validTo >= today);
  }

  async markNotified(id: number): Promise<void> {
    await this.repo.update(id, { notificationSent: true });
  }

  applyDiscount(price: number, promo: Promo): number {
    if (promo.discountPercent) return Math.round(price * (1 - promo.discountPercent / 100));
    if (promo.discountAmount) return Math.max(0, price - promo.discountAmount);
    return price;
  }
}
