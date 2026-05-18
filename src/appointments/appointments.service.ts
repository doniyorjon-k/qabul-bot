import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment, AppointmentStatus } from '../database/entities/appointment.entity';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepo: Repository<Appointment>,
  ) {}

  async create(data: Partial<Appointment>): Promise<Appointment> {
    const appointment = this.appointmentsRepo.create(data);
    return this.appointmentsRepo.save(appointment);
  }

  async findById(id: number): Promise<Appointment | null> {
    return this.appointmentsRepo.findOne({
      where: { id },
      relations: ['user', 'service', 'timeSlot'],
    });
  }

  async findByUserId(userId: number): Promise<Appointment[]> {
    return this.appointmentsRepo.find({
      where: { user: { id: userId } },
      relations: ['service', 'timeSlot'],
      order: { createdAt: 'DESC' },
    });
  }

  async findTodayAppointments(): Promise<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.appointmentsRepo.find({
      where: {
        timeSlot: { date: today },
        status: AppointmentStatus.CONFIRMED,
      },
      relations: ['user', 'service', 'timeSlot'],
      order: { timeSlot: { time: 'ASC' } },
    });
  }

  async findWeekAppointments(): Promise<Appointment[]> {
    const today = new Date();
    const weekEnd = new Date();
    weekEnd.setDate(today.getDate() + 7);

    return this.appointmentsRepo.find({
      where: {
        status: AppointmentStatus.CONFIRMED,
      },
      relations: ['user', 'service', 'timeSlot'],
      order: { timeSlot: { date: 'ASC', time: 'ASC' } },
    });
  }

  async findUpcomingByUser(userId: number): Promise<Appointment[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.appointmentsRepo
      .createQueryBuilder('apt')
      .leftJoinAndSelect('apt.service', 'service')
      .leftJoinAndSelect('apt.timeSlot', 'slot')
      .where('apt.user_id = :userId', { userId })
      .andWhere('apt.status IN (:...statuses)', { statuses: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] })
      .andWhere('slot.date >= :today', { today })
      .orderBy('slot.date', 'ASC')
      .addOrderBy('slot.time', 'ASC')
      .getMany();
  }

  async findPendingByAdmin(): Promise<Appointment[]> {
    return this.appointmentsRepo.find({
      where: { status: AppointmentStatus.PENDING },
      relations: ['user', 'service', 'timeSlot'],
      order: { createdAt: 'ASC' },
    });
  }

  async cancel(id: number, reason?: string): Promise<void> {
    await this.appointmentsRepo.update(id, {
      status: AppointmentStatus.CANCELLED,
      ...(reason ? { cancelReason: reason } : {}),
    });
  }

  async confirm(id: number): Promise<void> {
    await this.appointmentsRepo.update(id, { status: AppointmentStatus.CONFIRMED });
  }

  async complete(id: number): Promise<void> {
    await this.appointmentsRepo.update(id, { status: AppointmentStatus.COMPLETED });
  }

  async getPendingReminders1Day(): Promise<Appointment[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    return this.appointmentsRepo.find({
      where: {
        timeSlot: { date: tomorrowStr },
        status: AppointmentStatus.CONFIRMED,
        reminder1DaySent: false,
      },
      relations: ['user', 'service', 'timeSlot'],
    });
  }

  async getPendingReminders2Hours(): Promise<Appointment[]> {
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = `${String(in2Hours.getHours()).padStart(2, '0')}:${String(in2Hours.getMinutes()).padStart(2, '0')}`;

    return this.appointmentsRepo.find({
      where: {
        timeSlot: { date: todayStr, time: timeStr },
        status: AppointmentStatus.CONFIRMED,
        reminder2HourSent: false,
      },
      relations: ['user', 'service', 'timeSlot'],
    });
  }

  async markReminder1DaySent(id: number): Promise<void> {
    await this.appointmentsRepo.update(id, { reminder1DaySent: true });
  }

  async markReminder2HourSent(id: number): Promise<void> {
    await this.appointmentsRepo.update(id, { reminder2HourSent: true });
  }

  async getPendingReviewRequests(): Promise<Appointment[]> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const candidates = await this.appointmentsRepo.find({
      where: {
        status: AppointmentStatus.CONFIRMED,
        reviewRequestSent: false,
      },
      relations: ['user', 'service', 'timeSlot'],
    });

    return candidates.filter((apt) => {
      if (!apt.timeSlot?.date || !apt.timeSlot?.time) return false;
      if (apt.timeSlot.date < sevenDaysAgoStr) return false;
      const [h, m] = apt.timeSlot.time.split(':').map(Number);
      const aptDate = new Date(apt.timeSlot.date);
      aptDate.setHours(h, m, 0, 0);
      return now.getTime() - aptDate.getTime() >= 2 * 60 * 60 * 1000;
    });
  }

  async markReviewRequestSent(id: number): Promise<void> {
    await this.appointmentsRepo.update(id, { reviewRequestSent: true });
  }

  async getStats(): Promise<{ total: number; confirmed: number; cancelled: number; completed: number }> {
    const [total, confirmed, cancelled, completed] = await Promise.all([
      this.appointmentsRepo.count(),
      this.appointmentsRepo.count({ where: { status: AppointmentStatus.CONFIRMED } }),
      this.appointmentsRepo.count({ where: { status: AppointmentStatus.CANCELLED } }),
      this.appointmentsRepo.count({ where: { status: AppointmentStatus.COMPLETED } }),
    ]);
    return { total, confirmed, cancelled, completed };
  }
}
