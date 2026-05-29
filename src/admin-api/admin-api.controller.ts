import {
  Controller, Get, Post, Put, Param, Body, Query,
  Headers, UnauthorizedException, BadRequestException, ParseIntPipe,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { PlansService } from '../plans/plans.service';
import { PromosService } from '../promos/promos.service';
import { PaymentsService } from '../payments/payments.service';
import { ClinicStatus } from '../database/entities/clinic.entity';

@Controller('api/admin')
export class AdminApiController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
    private readonly workScheduleService: WorkScheduleService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly clinicsService: ClinicsService,
    private readonly clinicBotsService: ClinicBotsService,
    private readonly plansService: PlansService,
    private readonly promosService: PromosService,
    private readonly paymentsService: PaymentsService,
  ) {}

  private async validateAdmin(initData: string, clinicIdHeader: string): Promise<number> {
    if (!initData) throw new UnauthorizedException('initData yo\'q');
    if (!clinicIdHeader) throw new UnauthorizedException('x-clinic-id yo\'q');

    const clinicId = parseInt(clinicIdHeader, 10);
    if (isNaN(clinicId)) throw new UnauthorizedException('Noto\'g\'ri clinic id');

    const clinic = await this.clinicsService.findById(clinicId);
    if (!clinic) throw new UnauthorizedException('Klinika topilmadi');

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('hash yo\'q');
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = createHmac('sha256', 'WebAppData').update(clinic.botToken).digest();
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (expectedHash !== hash) throw new UnauthorizedException('Noto\'g\'ri initData');

    const userStr = params.get('user');
    if (!userStr) throw new UnauthorizedException('user yo\'q');
    const user = JSON.parse(userStr);
    if (!clinic.adminIds.includes(user.id)) throw new UnauthorizedException('Admin emas');

    return clinicId;
  }

  private parseAdminTelegramId(initData: string): number {
    const params = new URLSearchParams(initData);
    return JSON.parse(params.get('user') || '{}').id as number;
  }

  @Get('stats')
  async getStats(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    const [stats, users, reviewStats, monthly] = await Promise.all([
      this.appointmentsService.getStats(clinicId),
      this.usersService.count(clinicId),
      this.reviewsService.getStats(clinicId),
      this.appointmentsService.getMonthlyStats(clinicId),
    ]);
    return { ...stats, users, reviewStats, monthly };
  }

  @Get('appointments/today')
  async getToday(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.appointmentsService.findTodayAppointments(clinicId);
  }

  @Get('appointments/week')
  async getWeek(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.appointmentsService.findWeekAppointments(clinicId);
  }

  @Get('appointments/all')
  async getAll(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.appointmentsService.findAllForAdmin(clinicId);
  }

  @Get('appointments/search')
  async search(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Query('q') q: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    if (!q || q.trim().length < 2) return [];
    return this.appointmentsService.searchAppointments(clinicId, q.trim());
  }

  @Get('reviews')
  async getReviews(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.reviewsService.findAll(clinicId, 50);
  }

  @Post('appointments/:id/cancel')
  async cancelApt(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) throw new BadRequestException('Topilmadi');

    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    if (msLeft <= 0) throw new BadRequestException('Qabul allaqachon yakunlangan');
    if (msLeft <= 30 * 60 * 1000) throw new BadRequestException('30 daqiqadan kam vaqt qoldi');

    await this.appointmentsService.cancel(id, reason);
    if (apt.timeSlot) await this.timeSlotsService.freeSlot(apt.timeSlot.id);
    try {
      const [y, m, d] = apt.timeSlot.date.split('-');
      await this.clinicBotsService.sendMessage(
        clinicId,
        apt.user.telegramId,
        `❌ *Qabulingiz bekor qilindi*\n\n🦷 ${apt.service.name}\n📅 ${d}.${m}.${y} soat ${apt.timeSlot.time}`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
    return { ok: true };
  }

  @Get('schedule')
  async getSchedule(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.workScheduleService.get(clinicId);
  }

  @Put('schedule/days')
  async saveWorkDays(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Body('days') days: number[],
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    if (!Array.isArray(days)) throw new BadRequestException('days massiv bo\'lishi kerak');
    await this.workScheduleService.saveWorkDays(clinicId, days.map(Number));
    await this.timeSlotsService.regenerateFutureSlots(clinicId);
    return { ok: true };
  }

  @Put('schedule/hours')
  async saveWorkHours(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Body('hours') hours: string[],
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    if (!Array.isArray(hours)) throw new BadRequestException('hours massiv bo\'lishi kerak');
    await this.workScheduleService.saveWorkHours(clinicId, hours);
    await this.timeSlotsService.regenerateFutureSlots(clinicId);
    return { ok: true };
  }

  @Post('schedule/toggle-date')
  async toggleDate(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Body('date') date: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('Noto\'g\'ri sana formati');
    const isNowWorking = await this.workScheduleService.toggleDate(clinicId, date);
    await this.timeSlotsService.regenerateFutureSlots(clinicId);
    return { ok: true, isWorking: isNowWorking };
  }

  @Get('settings')
  async getClinicSettings(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    return this.clinicSettingsService.get(clinicId);
  }

  @Put('settings')
  async updateClinicSettings(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Body() body: { name?: string; address?: string; phone?: string; telegram?: string; mapsUrl?: string; tgUrl?: string; igUrl?: string },
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    const { name, address, phone, telegram, mapsUrl, tgUrl, igUrl } = body;
    await this.clinicSettingsService.update(clinicId, { name, address, phone, telegram, mapsUrl, tgUrl, igUrl });
    return { ok: true };
  }

  @Get('subscription')
  async getSubscription(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    const clinic = await this.clinicsService.findById(clinicId);
    const plans = await this.plansService.findAll();
    const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
    const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - Date.now()) / 86400000) : null;
    return { status: clinic.status, endsAt, daysLeft, currentPlan: clinic.currentPlan, plans };
  }

  @Post('start-payment')
  async startPayment(
    @Headers('x-init-data') initData: string,
    @Headers('x-clinic-id') clinicIdHeader: string,
    @Body('planId') planId: number,
  ) {
    const clinicId = await this.validateAdmin(initData, clinicIdHeader);
    const adminTelegramId = this.parseAdminTelegramId(initData);
    const clinic = await this.clinicsService.findById(clinicId);
    const plan = await this.plansService.findById(Number(planId));
    if (!plan) throw new BadRequestException('Tarif topilmadi');

    // Same active plan — can't re-buy the same plan that's currently running
    if (clinic.status === ClinicStatus.ACTIVE && clinic.currentPlan === plan.name) {
      const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
      const dateStr = endsAt ? new Date(endsAt).toLocaleDateString('ru-RU') : '—';
      return { ok: false, message: `✅ Bu tarif ${dateStr} gacha faol` };
    }

    // Pending payment already exists
    const hasPending = await this.paymentsService.hasPendingByClinic(clinicId);
    if (hasPending) {
      return { ok: false, message: "⏳ Sizda jarayondagi to'lov mavjud. Super admin tasdiqlaguncha kuting." };
    }

    const promo = await this.promosService.findActive();
    let amount = plan.price;
    let promoLine = '';
    if (promo) {
      amount = this.promosService.applyDiscount(amount, promo);
      promoLine = `\n🎁 Promo: *${promo.title}* — chegirma qo'llanildi!\n`;
    }

    const cardNum = process.env.PAYMENT_CARD_NUMBER || '—';
    const cardOwner = process.env.PAYMENT_CARD_OWNER || '—';

    this.clinicBotsService.setAdminPaySession(clinicId, adminTelegramId, plan.id, plan.name, amount);
    await this.clinicBotsService.sendMessage(
      clinicId, adminTelegramId,
      `💳 *To'lov ma'lumotlari:*\n\n📋 Reja: *${plan.name}* (${plan.durationDays} kun)\n💰 Summa: *${amount.toLocaleString()} so'm*${promoLine}\n\n💳 Karta: \`${cardNum}\`\n👤 Egasi: *${cardOwner}*\n\nPul o'tkazganingizdan so'ng *skrinshotni yuboring:*`,
      { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'pay:cancel' }]] } },
    );

    return { ok: true };
  }
}
