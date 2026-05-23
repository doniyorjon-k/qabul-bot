import {
  Controller, Get, Post, Param, Body,
  Headers, UnauthorizedException, BadRequestException, ParseIntPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { UsersService } from '../users/users.service';

@Controller('api/admin')
export class AdminApiController {
  private readonly adminIds: number[];

  constructor(
    private readonly configService: ConfigService,
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly usersService: UsersService,
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
    const [stats, users] = await Promise.all([
      this.appointmentsService.getStats(),
      this.usersService.count(),
    ]);
    return { ...stats, users };
  }

  @Get('appointments/today')
  async getToday(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findTodayAppointments();
  }

  @Get('appointments/pending')
  async getPending(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findPendingByAdmin();
  }

  @Get('appointments/week')
  async getWeek(@Headers('x-init-data') initData: string) {
    this.validateAdmin(initData);
    return this.appointmentsService.findWeekAppointments();
  }

  @Post('appointments/:id/confirm')
  async confirmApt(
    @Headers('x-init-data') initData: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.validateAdmin(initData);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) throw new BadRequestException('Topilmadi');

    await this.appointmentsService.confirm(id);
    try {
      const [y, m, d] = apt.timeSlot.date.split('-');
      await this.bot.telegram.sendMessage(
        apt.user.telegramId,
        `✅ *Qabulingiz tasdiqlandi!*\n\n🦷 ${apt.service.name}\n📅 ${d}.${m}.${y} soat ${apt.timeSlot.time}`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
    return { ok: true };
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
}
