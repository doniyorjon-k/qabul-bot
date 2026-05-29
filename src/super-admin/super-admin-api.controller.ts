import {
  Controller, Get, Post, Put, Delete,
  Body, Param, ParseIntPipe, Headers,
  ForbiddenException, BadRequestException, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { ClinicsService } from '../clinics/clinics.service';
import { PaymentsService } from '../payments/payments.service';
import { PlansService } from '../plans/plans.service';
import { PromosService } from '../promos/promos.service';
import { SuperAdminBotService } from './super-admin-bot.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { Broadcast } from '../database/entities/broadcast.entity';
import { Appointment, AppointmentStatus } from '../database/entities/appointment.entity';
import { User } from '../database/entities/user.entity';
import { Review } from '../database/entities/review.entity';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';

@Controller('api/super-admin')
export class SuperAdminApiController {
  private readonly botToken: string;
  private readonly adminIds: number[];

  constructor(
    private readonly configService: ConfigService,
    private readonly clinicsService: ClinicsService,
    private readonly paymentsService: PaymentsService,
    private readonly plansService: PlansService,
    private readonly promosService: PromosService,
    private readonly superAdminBotService: SuperAdminBotService,
    private readonly clinicBotsService: ClinicBotsService,
    @InjectRepository(Broadcast) private readonly broadcastRepo: Repository<Broadcast>,
    @InjectRepository(Appointment) private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
  ) {
    this.botToken = configService.get<string>('superAdmin.botToken') || '';
    this.adminIds = configService.get<number[]>('superAdmin.ids') || [];
  }

  private validate(initData: string): number {
    if (!initData) throw new ForbiddenException('initData bo\'sh — mini appni Telegram bot orqali oching');
    if (!this.botToken) throw new ForbiddenException('SUPER_ADMIN_BOT_TOKEN serverde sozlanmagan');
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new ForbiddenException('hash yo\'q');
    params.delete('hash');
    const dataStr = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(this.botToken).digest();
    const computed = createHmac('sha256', secret).update(dataStr).digest('hex');
    if (computed !== hash) throw new ForbiddenException('HMAC mos kelmadi — bot token noto\'g\'ri yoki initData buzilgan');
    const userStr = params.get('user');
    if (!userStr) throw new ForbiddenException('user maydoni yo\'q');
    const user = JSON.parse(userStr);
    if (!this.adminIds.includes(user.id)) {
      throw new ForbiddenException(`ID ${user.id} SUPER_ADMIN_IDS da yo'q (hozir: ${this.adminIds.join(',')||'bo\'sh'})`);
    }
    return user.id;
  }

  // ── Stats ──────────────────────────────────────────────────────────
  @Get('stats')
  async getStats(@Headers('x-init-data') d: string) {
    this.validate(d);
    const [stats, pending] = await Promise.all([
      this.clinicsService.getStats(),
      this.paymentsService.findPending(),
    ]);
    return { ...stats, pendingPayments: pending.length };
  }

  // ── Clinics ────────────────────────────────────────────────────────
  @Get('clinics')
  async getClinics(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.clinicsService.findAll();
  }

  @Get('clinics/archived')
  async getArchivedClinics(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.clinicsService.findDeleted();
  }

  @Get('clinics/:id/stats')
  async getClinicStats(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, thisMonth, pending, confirmed, completed, cancelled, totalUsers, reviews, payments] =
      await Promise.all([
        this.appointmentRepo.count({ where: { clinic: { id } } }),
        this.appointmentRepo.count({ where: { clinic: { id }, createdAt: MoreThanOrEqual(startOfMonth) } }),
        this.appointmentRepo.count({ where: { clinic: { id }, status: AppointmentStatus.PENDING } }),
        this.appointmentRepo.count({ where: { clinic: { id }, status: AppointmentStatus.CONFIRMED } }),
        this.appointmentRepo.count({ where: { clinic: { id }, status: AppointmentStatus.COMPLETED } }),
        this.appointmentRepo.count({ where: { clinic: { id }, status: AppointmentStatus.CANCELLED } }),
        this.userRepo.count({ where: { clinic: { id }, isAdmin: false } }),
        this.reviewRepo.find({ where: { clinic: { id } }, select: ['rating'] }),
        this.paymentRepo.find({
          where: { clinic: { id }, status: PaymentStatus.CONFIRMED },
          relations: ['plan'],
          order: { createdAt: 'DESC' },
        }),
      ]);

    const avgRating = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const lastPayment = payments[0] ?? null;

    return {
      appointments: { total, thisMonth, pending, confirmed, completed, cancelled },
      users: { total: totalUsers },
      reviews: { total: reviews.length, avgRating },
      payments: {
        count: payments.length,
        totalAmount: totalPaid,
        lastPaymentDate: lastPayment?.createdAt ?? null,
        lastPlanName: lastPayment?.plan?.name ?? null,
      },
    };
  }

  @Get('clinics/:id')
  async getClinic(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    return this.clinicsService.findById(id);
  }

  @Post('clinics')
  async createClinic(@Body() body: any, @Headers('x-init-data') d: string) {
    this.validate(d);
    if (!body.name || !body.botToken) throw new BadRequestException('name and botToken required');
    const clinic = await this.clinicsService.create({
      name: body.name,
      botToken: body.botToken,
      adminBotToken: body.adminBotToken || null,
      adminIds: body.adminIds || [],
    });
    await this.clinicBotsService.startBot(clinic);
    if (clinic.adminBotToken) await this.clinicBotsService.startAdminBot(clinic);
    return clinic;
  }

  @Put('clinics/:id')
  async updateClinic(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Headers('x-init-data') d: string) {
    this.validate(d);
    const allowed = ['name', 'botToken', 'adminBotToken', 'adminIds', 'trialEndsAt', 'subscriptionEndsAt', 'status'];
    const patch: Record<string, any> = {};
    for (const k of allowed) if (body[k] !== undefined) patch[k] = body[k] === '' ? null : body[k];
    await this.clinicsService.update(id, patch);
    const clinic = await this.clinicsService.findById(id);
    if (clinic.adminBotToken) {
      await this.clinicBotsService.stopAdminBot(id);
      await this.clinicBotsService.startAdminBot(clinic);
    } else {
      await this.clinicBotsService.stopAdminBot(id);
    }
    return { ok: true };
  }

  @Delete('clinics/:id')
  async deleteClinic(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicBotsService.stopBot(id);
    await this.clinicsService.softDelete(id);
    return { ok: true };
  }

  @Post('clinics/:id/restore')
  async restoreClinic(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.restore(id);
    const clinic = await this.clinicsService.findById(id);
    if (clinic) await this.clinicBotsService.startBot(clinic);
    return { ok: true };
  }

  @Delete('clinics/:id/permanent')
  async permanentDeleteClinic(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.hardDelete(id);
    return { ok: true };
  }

  @Post('clinics/:id/suspend')
  async suspend(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.suspend(id);
    await this.clinicBotsService.stopBot(id);
    return { ok: true };
  }

  @Post('clinics/:id/activate')
  async activate(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.activate(id);
    const clinic = await this.clinicsService.findById(id);
    await this.clinicBotsService.startBot(clinic);
    return { ok: true };
  }

  @Post('clinics/:id/unlimited')
  async unlimited(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.setUnlimited(id);
    const clinic = await this.clinicsService.findById(id);
    await this.clinicBotsService.startBot(clinic);
    return { ok: true };
  }

  @Post('clinics/:id/extend-trial')
  async extendTrial(@Param('id', ParseIntPipe) id: number, @Body() body: { days?: number }, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.clinicsService.extendTrial(id, body.days ?? 7);
    const clinic = await this.clinicsService.findById(id);
    await this.clinicBotsService.startBot(clinic);
    return { ok: true };
  }

  // ── Payments ───────────────────────────────────────────────────────
  @Get('payments/pending')
  async getPending(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.paymentsService.findPending();
  }

  @Get('payments')
  async getAll(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.paymentsService.findAll();
  }

  @Get('payments/:id/screenshot')
  async getScreenshot(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-init-data') d: string,
    @Res() res: Response,
  ) {
    this.validate(d);
    const payment = await this.paymentsService.findById(id);
    if (!payment?.screenshotFileId) throw new BadRequestException('Screenshot topilmadi');
    // file_id belongs to clinic bot — must use clinic bot token for getFile
    const clinicToken = payment.clinic.botToken;
    const getFileRes = await fetch(
      `https://api.telegram.org/bot${clinicToken}/getFile?file_id=${payment.screenshotFileId}`,
    );
    const json: any = await getFileRes.json();
    if (!json.ok) throw new BadRequestException('Telegram faylni topamadi');
    const fileUrl = `https://api.telegram.org/file/bot${clinicToken}/${json.result.file_path}`;
    // Proxy through server — redirect causes CORS errors in browser fetch
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) throw new BadRequestException('Faylni yuklab bo\'lmadi');
    const buf = Buffer.from(await fileRes.arrayBuffer());
    res.setHeader('Content-Type', fileRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buf);
  }

  @Post('payments/:id/confirm')
  async confirm(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    const adminId = this.validate(d);
    const payment = await this.paymentsService.confirm(id, adminId);
    await this.clinicsService.addDays(payment.clinic.id, payment.plan.durationDays, payment.plan.name);
    const clinic = await this.clinicsService.findById(payment.clinic.id);
    await this.clinicBotsService.startBot(clinic);
    for (const aid of payment.clinic.adminIds) {
      try {
        await this.clinicBotsService.sendMessage(
          payment.clinic.id, aid,
          `✅ *To\'lovingiz tasdiqlandi!*\n\n📋 ${payment.plan.name} (${payment.plan.durationDays} kun)\n💰 ${payment.amount.toLocaleString()} so\'m\n\n🎉 Obunangiz faollashdi! Admin panelga kirish uchun quyidagi tugmani bosing.`,
          {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: '👨‍⚕️ /admin — Admin panelni ochish', callback_data: 'adm:open' }]] },
          },
        );
      } catch {}
    }
    return { ok: true };
  }

  @Post('payments/:id/reject')
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
    @Headers('x-init-data') d: string,
  ) {
    this.validate(d);
    const payment = await this.paymentsService.findById(id);
    if (payment) {
      await this.paymentsService.reject(id, body.reason || '');
      const plans = await this.plansService.findAll();
      const inlineKeyboard = [
        ...plans.map(p => ([{ text: `${p.name} — ${p.price.toLocaleString()} so'm (${p.durationDays} kun)`, callback_data: `pay:plan:${p.id}` }])),
        [{ text: '📞 Adminga murojaat', url: 'https://t.me/doniyorjon_k' }],
      ];
      for (const aid of payment.clinic.adminIds) {
        try {
          await this.clinicBotsService.sendMessage(
            payment.clinic.id, aid,
            `❌ *To\'lovingiz rad etildi.*\n\nSabab: ${body.reason || '—'}\n\nQayta to\'lov qilish uchun tarifni tanlang:`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: inlineKeyboard } },
          );
        } catch {}
      }
    }
    return { ok: true };
  }

  // ── Plans ──────────────────────────────────────────────────────────
  @Get('plans')
  async getPlans(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.plansService.findAll();
  }

  @Put('plans/:id')
  async updatePlan(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.plansService.update(id, body);
    return { ok: true };
  }

  // ── Promos ─────────────────────────────────────────────────────────
  @Get('promos')
  async getPromos(@Headers('x-init-data') d: string) {
    this.validate(d);
    return this.promosService.findAll();
  }

  @Post('promos')
  async createPromo(@Body() body: any, @Headers('x-init-data') d: string) {
    this.validate(d);
    return this.promosService.create(body);
  }

  @Put('promos/:id')
  async updatePromo(@Param('id', ParseIntPipe) id: number, @Body() body: any, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.promosService.update(id, body);
    return { ok: true };
  }

  @Delete('promos/:id')
  async deletePromo(@Param('id', ParseIntPipe) id: number, @Headers('x-init-data') d: string) {
    this.validate(d);
    await this.promosService.delete(id);
    return { ok: true };
  }

  // ── Broadcast ──────────────────────────────────────────────────────
  @Post('broadcast')
  async broadcast(@Body() body: { message: string; target?: string }, @Headers('x-init-data') d: string) {
    this.validate(d);
    if (!body.message) throw new BadRequestException('message required');
    let clinics = await this.clinicsService.findAll();
    if (body.target === 'active') clinics = clinics.filter((c) => c.status === 'active');
    else if (body.target === 'trial') clinics = clinics.filter((c) => c.status === 'trial');
    let sent = 0;
    for (const clinic of clinics) {
      for (const adminId of clinic.adminIds) {
        try {
          await this.clinicBotsService.sendMessage(clinic.id, adminId, body.message, { parse_mode: 'Markdown' });
          sent++;
        } catch {}
      }
    }
    await this.broadcastRepo.save(this.broadcastRepo.create({
      message: body.message,
      target: body.target || 'all',
      sentCount: sent,
    }));
    return { ok: true, sent };
  }
}
