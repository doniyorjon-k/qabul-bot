import {
  Controller, Get, Post, Put, Param, Body, Query,
  Headers, UnauthorizedException, BadRequestException, ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';

@Controller('api/admin')
export class AdminApiController {
  private readonly adminIds: number[];

  constructor(
    private readonly configService: ConfigService,
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
    private readonly workScheduleService: WorkScheduleService,
    private readonly clinicSettingsService: ClinicSettingsService,
    @InjectBot() private readonly bot: Telegraf,
  ) {
    this.adminIds = configService.get<number[]>('bot.adminIds') || [];
  }

  private validateAdmin(initData: string): number {
    if (!initData) throw new UnauthorizedException('initData yo\'q');

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('hash yo\'q');

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const token = this.configService.get<string>('bot.token');
    const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
    const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (expectedHash !== hash) throw new UnauthorizedException('Noto\'g\'ri initData');

    const userStr = params.get('user');
    if (!userStr) throw new UnauthorizedException('user yo\'q');

    const user = JSON.parse(userStr);
    if (!this.adminIds.includes(user.id)) throw new UnauthorizedException('Admin emas');

    return user.id;
  }

  @Get('stats')
  async getStats(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    const [stats, users, reviewStats, monthly] = await Promise.all([
      this.appointmentsService.getStats(),
      this.usersService.count(),
      this.reviewsService.getStats(),
      this.appointmentsService.getMonthlyStats(),
    ]);
    return { ...stats, users, reviewStats, monthly };
  }

  @Get('appointments/today')
  async getToday(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findTodayAppointments();
  }

  @Get('appointments/week')
  async getWeek(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findWeekAppointments();
  }

  @Get('appointments/all')
  async getAll(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findAllForAdmin();
  }

  @Get('appointments/search')
  async search(
    @Headers('x-init-data') initData: string,
    @Query('q') q: string,
  ) {
    this.validateAdmin(initData);
    if (!q || q.trim().length < 2) return [];
    return this.appointmentsService.searchAppointments(q.trim());
  }

  @Get('reviews')
  async getReviews(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.reviewsService.findAll(50);
  }

  @Post('appointments/:id/cancel')
  async cancelApt(
    @Headers('x-init-data') initData: string,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    this.validateAdmin(initData);
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
      await this.bot.telegram.sendMessage(
        apt.user.telegramId,
        `❌ *Qabulingiz bekor qilindi*\n\n🦷 ${apt.service.name}\n📅 ${d}.${m}.${y} soat ${apt.timeSlot.time}`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
    return { ok: true };
  }

  @Get('schedule')
  async getSchedule(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.workScheduleService.get();
  }

  @Put('schedule/days')
  async saveWorkDays(
    @Headers('x-init-data') initData: string,
    @Body('days') days: number[],
  ) {
    this.validateAdmin(initData);
    if (!Array.isArray(days)) throw new BadRequestException('days massiv bo\'lishi kerak');
    await this.workScheduleService.saveWorkDays(days.map(Number));
    return { ok: true };
  }

  @Put('schedule/hours')
  async saveWorkHours(
    @Headers('x-init-data') initData: string,
    @Body('hours') hours: string[],
  ) {
    this.validateAdmin(initData);
    if (!Array.isArray(hours)) throw new BadRequestException('hours massiv bo\'lishi kerak');
    await this.workScheduleService.saveWorkHours(hours);
    return { ok: true };
  }

  @Get('settings')
  async getClinicSettings(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.clinicSettingsService.get();
  }

  @Put('settings')
  async updateClinicSettings(
    @Headers('x-init-data') initData: string,
    @Body() body: { name?: string; address?: string; phone?: string; telegram?: string; mapsUrl?: string; tgUrl?: string; igUrl?: string },
  ) {
    this.validateAdmin(initData);
    const { name, address, phone, telegram, mapsUrl, tgUrl, igUrl } = body;
    await this.clinicSettingsService.update({ name, address, phone, telegram, mapsUrl, tgUrl, igUrl });
    return { ok: true };
  }
}
