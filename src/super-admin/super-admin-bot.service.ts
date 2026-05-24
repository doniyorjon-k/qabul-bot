import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { ClinicsService } from '../clinics/clinics.service';
import { PaymentsService } from '../payments/payments.service';
import { PlansService } from '../plans/plans.service';
import { PromosService } from '../promos/promos.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { Clinic, ClinicStatus } from '../database/entities/clinic.entity';
import { Payment, PaymentStatus } from '../database/entities/payment.entity';

@Injectable()
export class SuperAdminBotService implements OnModuleInit {
  private readonly logger = new Logger(SuperAdminBotService.name);
  private bot: Telegraf | null = null;
  private superAdminIds: number[] = [];
  private rejectSessions = new Map<number, number>(); // userId -> paymentId

  constructor(
    private readonly configService: ConfigService,
    private readonly clinicsService: ClinicsService,
    private readonly paymentsService: PaymentsService,
    private readonly plansService: PlansService,
    private readonly promosService: PromosService,
    private readonly clinicBotsService: ClinicBotsService,
  ) {}

  async onModuleInit() {
    const token = this.configService.get<string>('superAdmin.botToken');
    this.superAdminIds = this.configService.get<number[]>('superAdmin.ids') || [];

    if (!token) {
      this.logger.warn('SUPER_ADMIN_BOT_TOKEN not set — super admin bot disabled');
      return;
    }

    this.bot = new Telegraf(token);
    this.setupHandlers();

    const appUrl = this.configService.get<string>('app.url');
    if (appUrl) {
      try {
        await this.bot.telegram.setWebhook(`${appUrl}/webhook/super-admin`);
        this.logger.log('Super admin bot webhook set');
      } catch (e) {
        this.logger.error(`Super admin bot webhook error: ${e.message}`);
        this.bot.launch().catch((err) => this.logger.error(err.message));
      }
    } else {
      this.bot.launch().catch((err) => this.logger.error(err.message));
    }
  }

  private isSA(userId: number) {
    return this.superAdminIds.includes(userId);
  }

  private setupHandlers() {
    const bot = this.bot!;

    bot.start(async (ctx) => {
      if (!this.isSA(ctx.from.id)) return;
      await ctx.reply('🔐 *Super Admin Panel*\n\nXush kelibsiz!', {
        parse_mode: 'Markdown',
        ...this.mainKb(),
      });
    });

    bot.hears('📊 Statistika', async (ctx) => {
      if (!this.isSA(ctx.from.id)) return;
      await this.replyStats(ctx);
    });

    bot.hears('🏥 Klinikalar', async (ctx) => {
      if (!this.isSA(ctx.from.id)) return;
      await this.replyClinicsList(ctx, false);
    });

    bot.hears("💳 To'lovlar", async (ctx) => {
      if (!this.isSA(ctx.from.id)) return;
      await this.replyPending(ctx, false);
    });

    // ── Callbacks ─────────────────────────────────────────────────
    bot.action('sa:back', async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await ctx.editMessageText('🔐 *Super Admin Panel*', {
        parse_mode: 'Markdown',
        ...this.mainKbInline(),
      });
    });

    bot.action('sa:stats', async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await this.replyStats(ctx);
    });

    bot.action('sa:clinics', async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await this.replyClinicsList(ctx, true);
    });

    bot.action('sa:pending', async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await this.replyPending(ctx, true);
    });

    bot.action(/^sa:clinic:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await this.replyClinicDetail(ctx, parseInt((ctx as any).match[1]));
    });

    bot.action(/^sa:clinic:suspend:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      const id = parseInt((ctx as any).match[1]);
      await this.clinicsService.suspend(id);
      await this.clinicBotsService.stopBot(id);
      await ctx.editMessageText('⛔ Klinika to\'xtatildi.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Klinikaga qaytish', `sa:clinic:${id}`)]]),
      });
    });

    bot.action(/^sa:clinic:activate:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      const id = parseInt((ctx as any).match[1]);
      await this.clinicsService.activate(id);
      const clinic = await this.clinicsService.findById(id);
      await this.clinicBotsService.startBot(clinic);
      await ctx.editMessageText('✅ Klinika faollashtirildi.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Klinikaga qaytish', `sa:clinic:${id}`)]]),
      });
    });

    bot.action(/^sa:clinic:unlimited:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      const id = parseInt((ctx as any).match[1]);
      await this.clinicsService.setUnlimited(id);
      const clinic = await this.clinicsService.findById(id);
      if (clinic.status === ClinicStatus.EXPIRED || clinic.status === ClinicStatus.SUSPENDED) {
        await this.clinicsService.activate(id);
        await this.clinicBotsService.startBot(clinic);
      }
      await ctx.editMessageText('♾️ Cheksiz obuna berildi.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Klinikaga qaytish', `sa:clinic:${id}`)]]),
      });
    });

    bot.action(/^sa:clinic:trial:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      const id = parseInt((ctx as any).match[1]);
      await this.clinicsService.extendTrial(id, 7);
      const clinic = await this.clinicsService.findById(id);
      await this.clinicBotsService.startBot(clinic);
      await ctx.editMessageText('✅ Sinov muddati 7 kunga uzaytirildi.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Klinikaga qaytish', `sa:clinic:${id}`)]]),
      });
    });

    bot.action(/^sa:pay:confirm:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      await this.confirmPayment(ctx, parseInt((ctx as any).match[1]));
    });

    bot.action(/^sa:pay:reject:(\d+)$/, async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isSA(ctx.from.id)) return;
      const paymentId = parseInt((ctx as any).match[1]);
      this.rejectSessions.set(ctx.from.id, paymentId);
      await ctx.editMessageText(
        `❌ *To'lov #${paymentId} rad etilmoqda*\n\nRad etish sababini yozing:`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🚫 Bekor qilish', 'sa:pending')]]) },
      );
    });

    bot.on('text', async (ctx, next) => {
      if (!this.isSA(ctx.from.id)) return next();
      const paymentId = this.rejectSessions.get(ctx.from.id);
      if (!paymentId) return next();
      this.rejectSessions.delete(ctx.from.id);
      await this.rejectPayment(ctx, paymentId, (ctx.message as any).text);
    });
  }

  private mainKb() {
    return Markup.keyboard([
      ['📊 Statistika', '🏥 Klinikalar'],
      ["💳 To'lovlar"],
    ]).resize();
  }

  private mainKbInline() {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📊 Statistika', 'sa:stats'), Markup.button.callback('🏥 Klinikalar', 'sa:clinics')],
      [Markup.button.callback("💳 To'lovlar", 'sa:pending')],
    ]);
  }

  private async replyStats(ctx: any) {
    const [stats, pending] = await Promise.all([
      this.clinicsService.getStats(),
      this.paymentsService.findPending(),
    ]);
    const text =
      `📊 *Statistika*\n\n` +
      `🏥 Klinikalar:\n` +
      `• Jami: *${stats.total}*\n` +
      `• Sinov: *${stats.trial || 0}*\n` +
      `• Faol: *${stats.active || 0}*\n` +
      `• Grace: *${stats.grace || 0}*\n` +
      `• Tugagan: *${stats.expired || 0}*\n` +
      `• To\'xtatilgan: *${stats.suspended || 0}*\n\n` +
      `💳 Kutayotgan to\'lovlar: *${pending.length}*`;
    const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'sa:back')]]);
    ctx.callbackQuery
      ? await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb })
      : await ctx.reply(text, { parse_mode: 'Markdown', ...kb });
  }

  private async replyClinicsList(ctx: any, isEdit: boolean) {
    const clinics = await this.clinicsService.findAll();
    const icon: Record<string, string> = {
      trial: '🆓', active: '✅', grace: '⚠️', expired: '❌', suspended: '⛔',
    };
    const rows = clinics.map((c) => [
      Markup.button.callback(`${icon[c.status] || '?'} ${c.name}`, `sa:clinic:${c.id}`),
    ]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'sa:back')]);
    const text = `🏥 *Klinikalar* (${clinics.length} ta)`;
    isEdit
      ? await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) })
      : await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  }

  private async replyClinicDetail(ctx: any, clinicId: number) {
    const clinic = await this.clinicsService.findById(clinicId);
    if (!clinic) { await ctx.editMessageText('Topilmadi.'); return; }
    const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
    const endsStr = endsAt ? endsAt.toLocaleDateString('ru-RU') : 'Cheksiz';
    const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - Date.now()) / 86400000) : null;
    const labels: Record<string, string> = {
      trial: 'Sinov', active: 'Faol', grace: 'Grace', expired: 'Tugagan', suspended: "To'xtatilgan",
    };
    const text =
      `🏥 *${clinic.name}*\n\n` +
      `📊 Holat: *${labels[clinic.status] || clinic.status}*\n` +
      `📅 Muddat: *${endsStr}*${daysLeft !== null ? ` (${daysLeft} kun)` : ''}\n` +
      `👤 Admin IDs: ${clinic.adminIds.join(', ') || '—'}\n` +
      `🆔 ID: ${clinic.id}`;
    const btns: any[][] = [];
    if (clinic.status === ClinicStatus.SUSPENDED) {
      btns.push([Markup.button.callback('✅ Faollashtirish', `sa:clinic:activate:${clinicId}`)]);
    } else {
      btns.push([
        Markup.button.callback('⛔ To\'xtatish', `sa:clinic:suspend:${clinicId}`),
        Markup.button.callback('♾️ Cheksiz', `sa:clinic:unlimited:${clinicId}`),
      ]);
      if (clinic.status !== ClinicStatus.ACTIVE) {
        btns.push([Markup.button.callback('➕ 7 kun sinov', `sa:clinic:trial:${clinicId}`)]);
      }
    }
    btns.push([Markup.button.callback('⬅️ Klinikalar', 'sa:clinics')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
  }

  private async replyPending(ctx: any, isEdit: boolean) {
    const payments = await this.paymentsService.findPending();
    if (!payments.length) {
      const text = "💳 Kutayotgan to'lovlar yo'q.";
      const kb = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'sa:back')]]);
      isEdit ? await ctx.editMessageText(text, kb) : await ctx.reply(text, kb);
      return;
    }
    let text = `💳 *Kutayotgan to\'lovlar* (${payments.length} ta):\n\n`;
    const rows: any[][] = [];
    for (const p of payments) {
      text += `#${p.id} — ${p.clinic?.name} | ${p.plan?.name} | ${p.amount.toLocaleString()} so'm\n`;
      rows.push([
        Markup.button.callback(`✅ #${p.id}`, `sa:pay:confirm:${p.id}`),
        Markup.button.callback(`❌ #${p.id}`, `sa:pay:reject:${p.id}`),
      ]);
    }
    rows.push([Markup.button.callback('⬅️ Orqaga', 'sa:back')]);
    isEdit
      ? await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) })
      : await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  }

  private async confirmPayment(ctx: any, paymentId: number) {
    const payment = await this.paymentsService.findById(paymentId);
    if (!payment) { await ctx.editMessageText('Topilmadi.'); return; }
    if (payment.status !== PaymentStatus.PENDING) {
      await ctx.editMessageText(`To'lov #${paymentId} allaqachon ${payment.status}.`);
      return;
    }
    const confirmed = await this.paymentsService.confirm(paymentId, ctx.from.id);
    await this.clinicsService.addDays(confirmed.clinic.id, confirmed.plan.durationDays);

    const clinic = await this.clinicsService.findById(confirmed.clinic.id);
    await this.clinicBotsService.startBot(clinic);

    await ctx.editMessageText(
      `✅ *To'lov #${paymentId} tasdiqlandi!*\n\n🏥 ${confirmed.clinic.name}\n📋 ${confirmed.plan.name} (${confirmed.plan.durationDays} kun)\n💰 ${confirmed.amount.toLocaleString()} so'm`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback("💳 To'lovlar", 'sa:pending')]]) },
    );

    for (const adminId of confirmed.clinic.adminIds) {
      try {
        await this.clinicBotsService.sendMessage(
          confirmed.clinic.id,
          adminId,
          `✅ *To\'lovingiz tasdiqlandi!*\n\n📋 Reja: ${confirmed.plan.name} (${confirmed.plan.durationDays} kun)\n💰 Summa: ${confirmed.amount.toLocaleString()} so\'m\n\nObunangiz faollashdi! Xizmatdan bahramand bo\'ling. 😊`,
          { parse_mode: 'Markdown' },
        );
      } catch {}
    }
  }

  private async rejectPayment(ctx: any, paymentId: number, reason: string) {
    const payment = await this.paymentsService.findById(paymentId);
    if (!payment) { await ctx.reply('Topilmadi.'); return; }
    await this.paymentsService.reject(paymentId, reason);
    await ctx.reply(
      `❌ *To'lov #${paymentId} rad etildi.*\nSabab: ${reason}`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback("💳 To'lovlar", 'sa:pending')]]) },
    );
    for (const adminId of payment.clinic.adminIds) {
      try {
        await this.clinicBotsService.sendMessage(
          payment.clinic.id,
          adminId,
          `❌ *To\'lovingiz rad etildi.*\n\nSabab: ${reason}\n\nMuammo bo\'lsa murojaat qiling.`,
          { parse_mode: 'Markdown' },
        );
      } catch {}
    }
  }

  async handleWebhook(update: any): Promise<void> {
    if (!this.bot) return;
    await (this.bot as any).handleUpdate(update);
  }

  async notify(text: string, extra?: any): Promise<void> {
    if (!this.bot) return;
    for (const id of this.superAdminIds) {
      try { await this.bot.telegram.sendMessage(id, text, extra); } catch {}
    }
  }
}
