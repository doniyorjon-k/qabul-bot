import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Start, Help, On, Hears, InjectBot,
  Update, Action, Ctx, Next,
} from 'nestjs-telegraf';
import { Telegraf, Context, Markup } from 'telegraf';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { FaqService } from '../faq/faq.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';
import { ReviewsService } from '../reviews/reviews.service';
import {
  mainMenuKeyboard, cancelKeyboard, confirmKeyboard,
  nameStepKeyboard, phoneStepKeyboard,
} from './keyboards/main-menu.keyboard';
import {
  buildCalendarKeyboard, buildTimeKeyboard, buildServicesKeyboard, ScheduleInfo, fmtTime,
} from './keyboards/calendar.keyboard';
import { AppointmentStatus } from '../database/entities/appointment.entity';

interface SessionData {
  step?: string;
  serviceId?: number;
  slotId?: number;
  date?: string;
  calYear?: number;
  calMonth?: number;
  clientName?: string;
  clientPhone?: string;
  cancellingAptId?: number;
}

@Update()
@Injectable()
export class BotUpdate {
  private sessions = new Map<number, SessionData>();

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly workScheduleService: WorkScheduleService,
    private readonly faqService: FaqService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  private reviewSessions = new Map<number, { appointmentId: number; rating: number; serviceName: string; clientName: string; appointmentDate: string }>();

  private async getScheduleInfo(): Promise<ScheduleInfo> {
    const s = await this.workScheduleService.get();
    return {
      workDays: (s.workDays || []).map(Number),
      blockedDates: s.blockedDates || [],
      extraWorkDates: s.extraWorkDates || [],
    };
  }

  private getSession(userId: number): SessionData {
    if (!this.sessions.has(userId)) this.sessions.set(userId, {});
    return this.sessions.get(userId);
  }

  private clearSession(userId: number): void {
    this.sessions.set(userId, {});
  }

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const from = ctx.from;
    await this.usersService.findOrCreate(from.id, from.username);
    this.clearSession(from.id);

    const param = (ctx.message as any)?.text?.split(' ')[1]; // /start book

    const clinic = await this.clinicSettingsService.get();
    const socialLine = buildSocialLine(clinic);

    await ctx.reply(
      `👋 Assalomu alaykum, *${from.first_name}*!\n\n` +
      `*Tajribali vrach-stomatolog Ismatova Nargis* qabuliga yozilish botiga xush kelibsiz!\n\n` +
      `✨ Chiroyli tabassum — bu sizning eng yaxshi bezagingiz!\n\n` +
      (socialLine ? `Yangiliklardan xabardor bo'lish uchun:\n${socialLine}\n\n` : '') +
      `👇 Quyida kerakli boʻlimni tanlang:`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard() },
    );

    // Broadcast tugmasidan kelgan — darhol qabul bo'limini ochish
    if (param === 'book') {
      const services = await this.servicesService.findAll();
      const sess = this.getSession(from.id);
      sess.step = 'choose_service';
      await ctx.reply('🦷 Qaysi xizmatga yozilmoqchisiz?', buildServicesKeyboard(services));
    }
  }

  @Hears('🏠 Bosh menyu')
  async onHome(@Ctx() ctx: Context) {
    this.clearSession(ctx.from.id);
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  }

  // ── Xizmatlar ────────────────────────────────────────────────────
  @Hears('💼 Xizmatlar')
  async onServices(@Ctx() ctx: Context) {
    const services = await this.servicesService.findAll();
    let text = '💼 *Bizning xizmatlar:*\n\n';
    for (const s of services) {
      text += `${s.emoji || '🦷'} *${s.name}*\n`;
      text += `   ${s.description}\n\n`;
    }
    await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  }

  // ── Review ───────────────────────────────────────────────────────
  @Action(/^review:r:(\d+):(\d)$/)
  async onReviewRate(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const rating = parseInt((ctx as any).match[2]);
    const apt = await this.appointmentsService.findById(aptId);

    this.reviewSessions.set(ctx.from.id, {
      appointmentId: aptId,
      rating,
      serviceName: apt?.service?.name || '',
      clientName: apt?.clientName || '',
      appointmentDate: apt?.timeSlot?.date || '',
    });

    const stars = '⭐'.repeat(rating);
    await ctx.editMessageText(
      `${stars} *${rating}/5* baho berdingiz!\n\n📝 Endi qabulingiz haqida fikringizni yozing:\n_(ixtiyoriy)_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[
          Markup.button.callback('⏭ O\'tkazib yuborish', `review:skip:${aptId}`),
        ]]),
      },
    );
  }

  @Action(/^review:skip:(\d+)$/)
  async onReviewSkip(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const sess = this.reviewSessions.get(ctx.from.id);
    const rating = sess?.rating || 5;

    await this.reviewsService.create({
      telegramId: ctx.from.id,
      rating,
      serviceName: sess?.serviceName,
      clientName: sess?.clientName,
      appointmentDate: sess?.appointmentDate,
    });
    this.reviewSessions.delete(ctx.from.id);

    await ctx.editMessageText(
      `✅ *Fikringiz uchun rahmat!*\n\nBu bizni yanada yaxshilashga yordam beradi. 🙏`,
      { parse_mode: 'Markdown' },
    );
  }

  // ── FAQ ──────────────────────────────────────────────────────────
  @Hears('❓ Tez-tez so\'raladigan savollar')
  async onFaq(@Ctx() ctx: Context) {
    const faqs = await this.faqService.findAll();
    await ctx.reply(
      '❓ *Tez-tez so\'raladigan savollar*\n\nQiziqtirgan savolni tanlang:',
      { parse_mode: 'Markdown', ...buildFaqListKeyboard(faqs) },
    );
  }

  @Action(/^faq:show:(\d+)$/)
  async onFaqAnswer(@Ctx() ctx: Context) {
    const id = parseInt((ctx as any).match[1]);
    const item = await this.faqService.findById(id);
    if (!item) return ctx.answerCbQuery();
    await ctx.editMessageText(
      `<b>${escHtml(item.question)}</b>\n\n${escHtml(item.answer)}`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('⬅️ Savollarga qaytish', 'faq:list')],
        ]).reply_markup,
      },
    );
    await ctx.answerCbQuery();
  }

  @Action('faq:list')
  async onFaqList(@Ctx() ctx: Context) {
    const faqs = await this.faqService.findAll();
    await ctx.editMessageText(
      '❓ *Tez-tez so\'raladigan savollar*\n\nQiziqtirgan savolni tanlang:',
      { parse_mode: 'Markdown', reply_markup: buildFaqListKeyboard(faqs).reply_markup },
    );
    await ctx.answerCbQuery();
  }

  // ── Manzil ───────────────────────────────────────────────────────
  @Hears('📍 Manzil')
  async onLocation(@Ctx() ctx: Context) {
    const clinic = await this.clinicSettingsService.get();

    const keyboard = clinic.mapsUrl
      ? Markup.inlineKeyboard([[Markup.button.url('📍 Xaritada ko\'rish', clinic.mapsUrl)]])
      : undefined;

    await ctx.reply(
      `📍 <b>Manzil:</b> ${escHtml(clinic.address)}`,
      { parse_mode: 'HTML', ...mainMenuKeyboard(), ...(keyboard ?? {}) },
    );
  }

  // ── Bog'lanish ───────────────────────────────────────────────────
  @Hears('📞 Bog\'lanish')
  async onContact(@Ctx() ctx: Context) {
    const clinic = await this.clinicSettingsService.get();

    let text = `📞 <b>Bog'lanish ma'lumotlari:</b>\n\n`;
    text += `📱 Telefon: ${escHtml(clinic.phone)}\n`;
    text += `💬 Telegram: ${escHtml(clinic.telegram)}\n`;

    if (clinic.tgUrl || clinic.igUrl) {
      text += `\n🌐 Ijtimoiy tarmoqlar:\n`;
      if (clinic.tgUrl) text += `<a href="${escHtml(clinic.tgUrl)}">Telegram</a>\n`;
      if (clinic.igUrl) text += `<a href="${escHtml(clinic.igUrl)}">Instagram</a>\n`;
    }

    text += `\n🦷 <b>${escHtml(clinic.name)}</b> — sizning tabassumingiz bizning g'ururimiz!`;

    await ctx.reply(text, { parse_mode: 'HTML', ...mainMenuKeyboard() });
  }

  // ── Qabullarim ───────────────────────────────────────────────────
  @Hears('📋 Qabullarim')
  async onMyAppointments(@Ctx() ctx: Context) {
    const user = await this.usersService.findByTelegramId(ctx.from.id);
    if (!user) { await ctx.reply('Avval /start bosing.'); return; }

    const apts = await this.appointmentsService.findUpcomingByUser(user.id);
    if (!apts.length) {
      await ctx.reply('📋 Sizda hozircha rejalashtirilgan qabul yo\'q.', mainMenuKeyboard());
      return;
    }

    const rows = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      return [Markup.button.callback(
        `📅 ${d}.${mo}.${y} ${fmtTime(a.timeSlot.time)} — ${a.service.name}`,
        `myapt:${a.id}`,
      )];
    });

    await ctx.reply(
      '📋 *Mening qabullarim:*',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) },
    );
  }

  @Action(/^myapt:(\d+)$/)
  async onMyAptDetail(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(aptId);
    if (!apt || apt.user.telegramId !== ctx.from.id) return;

    const [y, mo, d] = apt.timeSlot.date.split('-');
    const now = new Date();
    const aptDateTime = new Date(apt.timeSlot.date);
    const [h, m] = apt.timeSlot.time.split(':').map(Number);
    aptDateTime.setHours(h, m, 0, 0);
    const canCancel = aptDateTime.getTime() - now.getTime() > 2 * 60 * 60 * 1000;

    const text = `📋 *Qabul ma'lumotlari:*\n\n🦷 Xizmat: ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n👤 ${apt.clientName}\n📱 ${apt.clientPhone}`;

    const rows: any[][] = [];
    if (canCancel) {
      rows.push([Markup.button.callback('❌ Bekor qilish', `myapt:cancel:${apt.id}`)]);
    } else {
      rows.push([Markup.button.callback('⚠️ 2 soat qoldi, bekor qilib bo\'lmaydi', 'myapt:noop')]);
    }
    rows.push([Markup.button.callback('⬅️ Qabullarimga qaytish', 'myapt:list')]);

    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  }

  @Action('myapt:list')
  async onMyAptList(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const user = await this.usersService.findByTelegramId(ctx.from.id);
    if (!user) return;

    const apts = await this.appointmentsService.findUpcomingByUser(user.id);
    if (!apts.length) {
      await ctx.editMessageText('📋 Sizda hozircha rejalashtirilgan qabul yo\'q.');
      return;
    }

    const rows = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      return [Markup.button.callback(
        `📅 ${d}.${mo}.${y} ${fmtTime(a.timeSlot.time)} — ${a.service.name}`,
        `myapt:${a.id}`,
      )];
    });

    await ctx.editMessageText(
      '📋 *Mening qabullarim:*',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) },
    );
  }

  @Action('myapt:noop')
  async onMyAptNoop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('Qabulga 2 soatdan kam vaqt qoldi!', { show_alert: true });
  }

  @Action(/^myapt:cancel:(\d+)$/)
  async onMyAptCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(aptId);
    if (!apt || apt.user.telegramId !== ctx.from.id) return;

    const now = new Date();
    const aptDateTime = new Date(apt.timeSlot.date);
    const [h, m] = apt.timeSlot.time.split(':').map(Number);
    aptDateTime.setHours(h, m, 0, 0);

    if (aptDateTime.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) {
      await ctx.answerCbQuery('Qabulga 2 soatdan kam vaqt qoldi, bekor qilib bo\'lmaydi!', { show_alert: true });
      return;
    }

    const sess = this.getSession(ctx.from.id);
    sess.step = 'cancel_reason';
    sess.cancellingAptId = aptId;

    await ctx.editMessageText(
      '📝 Bekor qilish sababini yozing:\n_(masalan: Boshqa vaqtga ko\'chirmoqchiman)_',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', `myapt:${aptId}`)]]) },
    );
  }

  // ── Qabulga yozilish ─────────────────────────────────────────────
  @Hears('📅 Qabulga yozilish')
  async onAppointment(@Ctx() ctx: Context) {
    const services = await this.servicesService.findAll();
    const sess = this.getSession(ctx.from.id);
    sess.step = 'choose_service';

    await ctx.reply(
      '🦷 Qaysi xizmatga yozilmoqchisiz?',
      buildServicesKeyboard(services),
    );
  }

  @Action(/^svc:(\d+)$/)
  async onServiceChosen(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const serviceId = parseInt((ctx as any).match[1]);
    const service = await this.servicesService.findById(serviceId);
    if (!service) return;

    const sess = this.getSession(ctx.from.id);
    sess.serviceId = serviceId;
    sess.step = 'choose_date';

    const now = new Date();
    sess.calYear = now.getFullYear();
    sess.calMonth = now.getMonth();

    const schedule = await this.getScheduleInfo();
    await ctx.editMessageText(
      `✅ Xizmat: *${service.name}*\n\n📅 *Sanani tanlang:*\n🟢 = bo'sh kun (bosing) · 🔴 = dam olish`,
      { parse_mode: 'Markdown', ...buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule) },
    );
  }

  @Action('svc:back')
  async onSvcBack(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    this.clearSession(ctx.from.id);
    await ctx.editMessageText('🏠 Bosh menyuga qaytildi.');
    await ctx.reply('Quyidagi bo\'limlardan birini tanlang:', mainMenuKeyboard());
  }

  @Action('svc:cancel')
  async onSvcCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    this.clearSession(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  }

  // Kalendar navigatsiya
  @Action(/^cal:prev:(\d+):(\d+)$/)
  async onCalPrev(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const [, y, m] = (ctx as any).match;
    let year = parseInt(y), month = parseInt(m) - 1;
    if (month < 0) { month = 11; year--; }
    const sess = this.getSession(ctx.from.id);
    sess.calYear = year;
    sess.calMonth = month;
    const schedule = await this.getScheduleInfo();
    await ctx.editMessageReplyMarkup(buildCalendarKeyboard(year, month, schedule).reply_markup);
  }

  @Action(/^cal:next:(\d+):(\d+)$/)
  async onCalNext(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const [, y, m] = (ctx as any).match;
    let year = parseInt(y), month = parseInt(m) + 1;
    if (month > 11) { month = 0; year++; }
    const sess = this.getSession(ctx.from.id);
    sess.calYear = year;
    sess.calMonth = month;
    const schedule = await this.getScheduleInfo();
    await ctx.editMessageReplyMarkup(buildCalendarKeyboard(year, month, schedule).reply_markup);
  }

  @Action('cal:back')
  async onCalBack(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const services = await this.servicesService.findAll();
    const sess = this.getSession(ctx.from.id);
    sess.step = 'choose_service';
    await ctx.editMessageText(
      '🦷 Qaysi xizmatga yozilmoqchisiz?',
      buildServicesKeyboard(services),
    );
  }

  @Action('cal:ignore')
  async onCalIgnore(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
  }

  @Action('cal:cancel')
  async onCalCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    this.clearSession(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  }

  @Action(/^cal:select:(\d{4}-\d{2}-\d{2})$/)
  async onDateSelected(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const date = (ctx as any).match[1];
    const sess = this.getSession(ctx.from.id);
    sess.date = date;
    sess.step = 'choose_time';

    const slots = await this.timeSlotsService.getAllSlotsForDate(date);
    const freeCount = slots.filter((s) => !s.isBooked).length;

    if (slots.length === 0 || freeCount === 0) {
      const schedule = await this.getScheduleInfo();
      await ctx.editMessageText(
        `😔 Bu kunda barcha vaqtlar band.\nBoshqa sanani tanlang:`,
        buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule),
      );
      return;
    }

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = date === todayStr;
    const nowMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
    const availableCount = slots.filter((s) => {
      if (s.isBooked) return false;
      if (!isToday) return true;
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m > nowMinutes;
    }).length;

    if (availableCount === 0) {
      const schedule = await this.getScheduleInfo();
      await ctx.editMessageText(
        `😔 Bu kunda barcha vaqtlar o'tib ketgan yoki band.\nBoshqa sanani tanlang:`,
        buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule),
      );
      return;
    }

    const [year, month, day] = date.split('-').map(Number);
    await ctx.editMessageText(
      `📅 Sana: *${day}.${month}.${year}*\n\n🟢 Bo'sh  🔴 Band\nVaqtni tanlang:`,
      { parse_mode: 'Markdown', ...buildTimeKeyboard(slots, date) },
    );
  }

  // Vaqt tanlash
  @Action(/^time:(\d+)$/)
  async onTimeSelected(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const slotId = parseInt((ctx as any).match[1]);
    const slot = await this.timeSlotsService.findById(slotId);
    if (!slot || slot.isBooked) {
      await ctx.answerCbQuery('Bu vaqt band qilindi, boshqasini tanlang', { show_alert: true });
      return;
    }

    const sess = this.getSession(ctx.from.id);
    sess.slotId = slotId;
    sess.step = 'enter_name';

    await ctx.editMessageText('👤 Ismingizni kiriting:');
    await ctx.reply('Ismingizni yozing:', nameStepKeyboard());
  }

  @Action('time:booked')
  async onTimeBooked(@Ctx() ctx: Context) {
    await ctx.answerCbQuery('🔴 Bu vaqt band. Boshqa vaqtni tanlang.', { show_alert: true });
  }

  @Action('time:back')
  async onTimeBack(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    const sess = this.getSession(ctx.from.id);
    sess.step = 'choose_date';
    const schedule = await this.getScheduleInfo();
    const year = sess.calYear ?? new Date().getFullYear();
    const month = sess.calMonth ?? new Date().getMonth();
    await ctx.editMessageText(
      `📅 *Sanani tanlang:*\n🟢 = bo\'sh kun · 🔴 = dam olish`,
      { parse_mode: 'Markdown', ...buildCalendarKeyboard(year, month, schedule) },
    );
  }

  @Action('time:cancel')
  async onTimeCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    this.clearSession(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  }

  // ── Matn xabarlar oqimi ──────────────────────────────────────────
  @On('text')
  async onText(@Ctx() ctx: Context, @Next() next: () => Promise<void>) {
    const text = (ctx.message as any).text as string;
    if (text?.startsWith('/')) return next(); // buyruqlarni keyingi handler'ga o'tkazish

    const userId = ctx.from.id;
    const sess = this.getSession(userId);

    if (text === '❌ Bekor qilish') {
      this.clearSession(userId);
      await ctx.reply('❌ Bekor qilindi.', mainMenuKeyboard());
      return;
    }

    if (text === '⬅️ Orqaga') {
      await this.handleBack(ctx, sess);
      return;
    }

    if (sess.step === 'enter_name') {
      if (text.length < 2) {
        await ctx.reply('❗ Iltimos, to\'liq ism kiriting:');
        return;
      }
      sess.clientName = text;
      sess.step = 'enter_phone';
      await ctx.reply(
        '📱 Telefon raqamingizni yuboring yoki kiriting (+998XXXXXXXXX):',
        phoneStepKeyboard(),
      );
      return;
    }

    if (sess.step === 'enter_phone') {
      const phone = text.replace(/\s/g, '');
      if (!/^\+?[0-9]{9,13}$/.test(phone)) {
        await ctx.reply('❗ Telefon raqam noto\'g\'ri. Qayta kiriting (+998XXXXXXXXX):');
        return;
      }
      sess.clientPhone = phone;
      sess.step = 'confirm';
      await this.showConfirmation(ctx, sess);
      return;
    }

    if (sess.step === 'confirm_text') {
      if (text === '✅ Tasdiqlash') {
        await this.createAppointment(ctx, sess);
      } else {
        this.clearSession(userId);
        await ctx.reply('❌ Bekor qilindi.', mainMenuKeyboard());
      }
      return;
    }

    // Bekor qilish sababi
    if (sess.step === 'cancel_reason' && sess.cancellingAptId) {
      const aptId = sess.cancellingAptId;
      const apt = await this.appointmentsService.findById(aptId);
      if (apt && apt.user.telegramId === userId) {
        const now = new Date();
        const aptDateTime = new Date(apt.timeSlot.date);
        const [hh, mm] = apt.timeSlot.time.split(':').map(Number);
        aptDateTime.setHours(hh, mm, 0, 0);

        if (aptDateTime.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) {
          this.clearSession(userId);
          await ctx.reply('⚠️ Qabulga 2 soatdan kam vaqt qoldi, bekor qilib bo\'lmaydi!', mainMenuKeyboard());
          return;
        }

        await this.appointmentsService.cancel(aptId, text);
        if (apt.timeSlot) await this.timeSlotsService.freeSlot(apt.timeSlot.id);
        this.clearSession(userId);

        await this.notifyAdminsCancelled(aptId, apt.clientName, apt.timeSlot.date, apt.timeSlot.time, apt.service.name, text, false);
        await ctx.reply('✅ Qabulingiz bekor qilindi.', mainMenuKeyboard());
      } else {
        this.clearSession(userId);
      }
      return;
    }

    // Review komment
    const reviewSess = this.reviewSessions.get(userId);
    if (reviewSess) {
      await this.reviewsService.create({
        telegramId: userId,
        rating: reviewSess.rating,
        comment: text,
        serviceName: reviewSess.serviceName,
        clientName: reviewSess.clientName,
        appointmentDate: reviewSess.appointmentDate,
      });
      this.reviewSessions.delete(userId);
      await ctx.reply(
        '✅ *Fikringiz uchun rahmat!*\n\nBu bizni yanada yaxshilashga yordam beradi. 🙏',
        { parse_mode: 'Markdown', ...mainMenuKeyboard() },
      );
      return;
    }

    return next();
  }

  @On('contact')
  async onContact2(@Ctx() ctx: Context) {
    const contact = (ctx.message as any).contact;
    const sess = this.getSession(ctx.from.id);

    if (sess.step === 'enter_phone') {
      sess.clientPhone = contact.phone_number;
      sess.step = 'confirm';
      await this.showConfirmation(ctx, sess);
    }
  }

  private async showConfirmation(ctx: Context, sess: SessionData) {
    const service = await this.servicesService.findById(sess.serviceId);
    const slot = await this.timeSlotsService.findById(sess.slotId);
    const [y, m, d] = sess.date.split('-');

    const text = `📋 *Qabul ma\'lumotlari:*

🦷 Xizmat: *${service.name}*
📅 Sana: *${d}.${m}.${y}*
🕐 Vaqt: *${fmtTime(slot.time)}*
👤 Ism: *${sess.clientName}*
📱 Telefon: *${sess.clientPhone}*

Tasdiqlaysizmi?`;

    sess.step = 'confirm_text';
    await ctx.reply(text, { parse_mode: 'Markdown', ...confirmKeyboard() });
  }

  private async handleBack(ctx: Context, sess: SessionData) {
    const { Markup } = await import('telegraf');

    if (sess.step === 'confirm_text') {
      // Tasdiqlash → Telefon kiritish
      sess.step = 'enter_phone';
      await ctx.reply(
        '📱 Telefon raqamingizni yuboring yoki kiriting (+998XXXXXXXXX):',
        phoneStepKeyboard(),
      );

    } else if (sess.step === 'enter_phone') {
      // Telefon → Ism kiritish
      sess.step = 'enter_name';
      sess.clientPhone = undefined;
      await ctx.reply('👤 Ismingizni kiriting:', nameStepKeyboard());

    } else if (sess.step === 'enter_name') {
      // Ism → Vaqt tanlash
      if (!sess.date || !sess.slotId) {
        await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
        this.clearSession(ctx.from.id);
        return;
      }
      sess.step = 'choose_time';
      sess.clientName = undefined;
      const slots = await this.timeSlotsService.getAllSlotsForDate(sess.date);
      const [y, m, d] = sess.date.split('-').map(Number);
      await ctx.reply(
        `📅 Sana: *${d}.${m}.${y}*\n\n🟢 Bo'sh  🔴 Band\nVaqtni tanlang:`,
        { parse_mode: 'Markdown', ...buildTimeKeyboard(slots, sess.date) },
      );

    } else {
      this.clearSession(ctx.from.id);
      await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
    }
  }

  private async createAppointment(ctx: Context, sess: SessionData) {
    const user = await this.usersService.findByTelegramId(ctx.from.id);
    const slot = await this.timeSlotsService.findById(sess.slotId);

    if (!slot || slot.isBooked) {
      await ctx.reply('😔 Afsuski, bu vaqt band qilingan. Qaytadan yozilib ko\'ring.', mainMenuKeyboard());
      this.clearSession(ctx.from.id);
      return;
    }

    await this.timeSlotsService.bookSlot(sess.slotId);

    const appointment = await this.appointmentsService.create({
      user,
      service: { id: sess.serviceId } as any,
      timeSlot: { id: sess.slotId } as any,
      clientName: sess.clientName,
      clientPhone: sess.clientPhone,
      status: AppointmentStatus.CONFIRMED,
    });

    await this.usersService.updateProfile(ctx.from.id, {
      fullName: sess.clientName,
      phone: sess.clientPhone,
    });

    const service = await this.servicesService.findById(sess.serviceId);
    const [y, m, d] = sess.date.split('-');
    await ctx.reply(
      `✅ *Qabul muvaffaqiyatli yozildi!*

🦷 Xizmat: ${service.name}
📅 ${d}.${m}.${y} soat ${fmtTime(slot.time)}
👤 ${sess.clientName}

Sog'lom tish — baxtli kun! 😊
Qabuldan 2 soat oldin xabar beramiz.`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard() },
    );

    await this.notifyAdmins(appointment.id, sess, slot.time);
    this.clearSession(ctx.from.id);
  }

  async notifyAdminsCancelled(
    aptId: number,
    clientName: string,
    date: string,
    time: string,
    serviceName: string,
    reason: string,
    byAdmin: boolean,
  ) {
    const adminIds = this.configService.get<number[]>('bot.adminIds');
    if (!adminIds?.length) return;
    const [y, mo, d] = date.split('-');
    const who = byAdmin ? 'Admin' : 'Mijoz';
    const text = `❌ *Qabul #${aptId} bekor qilindi* (${who})\n\n🦷 ${serviceName}\n📅 ${d}.${mo}.${y} soat ${fmtTime(time)}\n👤 ${clientName}\n📝 Sabab: ${reason}`;
    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
      } catch {}
    }
  }

  private async notifyAdmins(appointmentId: number, sess: SessionData, time: string) {
    const adminIds = this.configService.get<number[]>('bot.adminIds');
    if (!adminIds?.length) return;

    const service = await this.servicesService.findById(sess.serviceId);
    const [y, m, d] = sess.date.split('-');
    const text = `🔔 *Yangi qabul #${appointmentId}*

🦷 Xizmat: ${service.name}
📅 ${d}.${m}.${y} soat ${fmtTime(time)}
👤 ${sess.clientName}
📱 ${sess.clientPhone}`;

    for (const adminId of adminIds) {
      try {
        await this.bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
      } catch {}
    }
  }
}

function buildFaqListKeyboard(faqs: { id: number; question: string }[]) {
  return Markup.inlineKeyboard(faqs.map((f) => [
    Markup.button.callback(f.question, `faq:show:${f.id}`),
  ]));
}

function escHtml(s: string | null | undefined): string {
  return (s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSocialLine(clinic: { tgUrl?: string; igUrl?: string }): string {
  const parts: string[] = [];
  if (clinic.tgUrl) parts.push(`[Telegram](${clinic.tgUrl})`);
  if (clinic.igUrl) parts.push(`[Instagram](${clinic.igUrl})`);
  return parts.join('  ·  ');
}
