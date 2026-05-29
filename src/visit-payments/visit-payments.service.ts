import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VisitPayment, VisitPaymentStatus } from '../database/entities/visit-payment.entity';

@Injectable()
export class VisitPaymentsService {
  constructor(
    @InjectRepository(VisitPayment)
    private readonly vpRepo: Repository<VisitPayment>,
  ) {}

  async create(data: {
    clinicId: number;
    appointmentId?: number;
    userId?: number;
    items: { serviceName: string; price: number }[];
    totalAmount: number;
    paidAmount: number;
    status: VisitPaymentStatus;
    reason?: string;
  }): Promise<VisitPayment> {
    const vp = this.vpRepo.create({
      clinic: { id: data.clinicId } as any,
      appointment: data.appointmentId ? { id: data.appointmentId } as any : null,
      user: data.userId ? { id: data.userId } as any : null,
      items: data.items,
      totalAmount: data.totalAmount,
      paidAmount: data.paidAmount,
      status: data.status,
      reason: data.reason ?? null,
    });
    return this.vpRepo.save(vp);
  }

  async findByClinic(clinicId: number, limit = 200): Promise<VisitPayment[]> {
    return this.vpRepo.find({
      where: { clinic: { id: clinicId } },
      relations: ['appointment', 'appointment.timeSlot', 'user'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByAppointment(appointmentId: number): Promise<VisitPayment | null> {
    return this.vpRepo.findOne({
      where: { appointment: { id: appointmentId } },
      relations: ['user'],
    });
  }

  async hasPaymentForAppointment(appointmentId: number): Promise<boolean> {
    const count = await this.vpRepo.count({ where: { appointment: { id: appointmentId } } });
    return count > 0;
  }

  async getRevenueStats(clinicId: number, noShowCount: number): Promise<{
    totalRevenue: number;
    today: number;
    thisMonth: number;
    lastMonth: number;
    unpaidCount: number;
    partialCount: number;
    noShowCount: number;
    byService: { name: string; count: number; revenue: number }[];
    byUser: { name: string; count: number; revenue: number }[];
  }> {
    const payments = await this.vpRepo.find({
      where: { clinic: { id: clinicId } },
      relations: ['appointment', 'appointment.timeSlot', 'user'],
      order: { createdAt: 'DESC' },
    });

    const now = new Date();
    const uzNow = new Date(now.getTime() + 5 * 3600000);
    const todayStr = uzNow.toISOString().split('T')[0];
    const thisMonthStr = todayStr.slice(0, 7);
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}`;

    let totalRevenue = 0, today = 0, thisMonth = 0, lastMonth = 0;
    let unpaidCount = 0, partialCount = 0;
    const byService: Record<string, { count: number; revenue: number }> = {};
    const byUser: Record<string, { name: string; count: number; revenue: number }> = {};

    for (const p of payments) {
      totalRevenue += p.paidAmount;
      if (p.status === VisitPaymentStatus.UNPAID) unpaidCount++;
      if (p.status === VisitPaymentStatus.PARTIAL) partialCount++;

      const aptDate = p.appointment?.timeSlot?.date || '';
      if (aptDate === todayStr) today += p.paidAmount;
      if (aptDate.startsWith(thisMonthStr)) thisMonth += p.paidAmount;
      if (aptDate.startsWith(lastMonthStr)) lastMonth += p.paidAmount;

      for (const item of (p.items || [])) {
        if (!byService[item.serviceName]) byService[item.serviceName] = { count: 0, revenue: 0 };
        byService[item.serviceName].count++;
        byService[item.serviceName].revenue += item.price;
      }

      if (p.user) {
        const key = String(p.user.id);
        const userName = p.user.fullName || p.user.username || `ID:${p.user.telegramId}`;
        if (!byUser[key]) byUser[key] = { name: userName, count: 0, revenue: 0 };
        byUser[key].count++;
        byUser[key].revenue += p.paidAmount;
      }
    }

    return {
      totalRevenue,
      today,
      thisMonth,
      lastMonth,
      unpaidCount,
      partialCount,
      noShowCount,
      byService: Object.entries(byService)
        .map(([name, v]) => ({ name, ...v }))
        .sort((a, b) => b.revenue - a.revenue),
      byUser: Object.values(byUser)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10),
    };
  }

  async getDailyStats(clinicId: number, dateStr: string): Promise<{
    paid: number; paidAmount: number;
    partial: number; partialAmount: number;
    unpaid: number;
  }> {
    const payments = await this.vpRepo.find({
      where: { clinic: { id: clinicId } },
      relations: ['appointment', 'appointment.timeSlot'],
    });

    const dayPayments = payments.filter(p => p.appointment?.timeSlot?.date === dateStr);

    return {
      paid: dayPayments.filter(p => p.status === VisitPaymentStatus.PAID).length,
      paidAmount: dayPayments.filter(p => p.status === VisitPaymentStatus.PAID).reduce((s, p) => s + p.paidAmount, 0),
      partial: dayPayments.filter(p => p.status === VisitPaymentStatus.PARTIAL).length,
      partialAmount: dayPayments.filter(p => p.status === VisitPaymentStatus.PARTIAL).reduce((s, p) => s + p.paidAmount, 0),
      unpaid: dayPayments.filter(p => p.status === VisitPaymentStatus.UNPAID).length,
    };
  }
}
