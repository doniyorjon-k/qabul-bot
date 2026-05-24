import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';
import { Clinic } from '../database/entities/clinic.entity';
import { Plan } from '../database/entities/plan.entity';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private readonly repo: Repository<Payment>,
  ) {}

  async create(data: {
    clinic: Clinic;
    plan: Plan;
    amount: number;
    adminTelegramId: number;
    screenshotFileId?: string;
  }): Promise<Payment> {
    return this.repo.save(this.repo.create({
      ...data,
      status: PaymentStatus.PENDING,
    }));
  }

  async findPending(): Promise<Payment[]> {
    return this.repo.find({
      where: { status: PaymentStatus.PENDING },
      relations: ['clinic', 'plan'],
      order: { createdAt: 'ASC' },
    });
  }

  async findByClinic(clinicId: number): Promise<Payment[]> {
    return this.repo.find({
      where: { clinic: { id: clinicId } },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(limit = 50): Promise<Payment[]> {
    return this.repo.find({
      relations: ['clinic', 'plan'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findById(id: number): Promise<Payment | null> {
    return this.repo.findOne({ where: { id }, relations: ['clinic', 'plan'] });
  }

  async confirm(id: number, confirmedBy: number): Promise<Payment> {
    await this.repo.update(id, { status: PaymentStatus.CONFIRMED, confirmedBy });
    return this.repo.findOne({ where: { id }, relations: ['clinic', 'plan'] });
  }

  async reject(id: number, reason: string): Promise<void> {
    await this.repo.update(id, { status: PaymentStatus.REJECTED, rejectionReason: reason });
  }

  async hasPendingByClinic(clinicId: number): Promise<boolean> {
    const count = await this.repo.count({
      where: { clinic: { id: clinicId }, status: PaymentStatus.PENDING },
    });
    return count > 0;
  }
}
