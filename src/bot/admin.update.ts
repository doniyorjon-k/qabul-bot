import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command, Ctx, InjectBot, Update, Action, On, Next } from 'nestjs-telegraf';
import { Context, Markup, Telegraf } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { UsersService } from '../users/users.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { ServicesService } from '../services/services.service';
import { FaqService } from '../faq/faq.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { fmtTime } from './keyboards/calendar.keyboard';

const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const UZ_WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const ALL_HOURS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
];

interface AdminSession {
  hours?: string[];
  broadcastStep?: string;
  broadcastText?: string;
  broadcastPhotoId?: string;
  broadcastCustomButtons?: any[][];
  step?: string;
  editId?: number;
  tempText?: string;
  rejectAptId?: number;
}


const adminSessions = new Map<number, AdminSession>();

@Update()
@Injectable()
export class AdminUpdate implements OnModuleInit {
  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly configService: ConfigService,
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly usersService: UsersService,
    private readonly workScheduleService: WorkScheduleService,
    private readonly servicesService: ServicesService,
    private readonly faqService: FaqService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly reviewsService: ReviewsService,
  ) {}

  private adminCache = new Set<number>();

  async onModuleInit() {
    await this.refreshAdminCache();
  }

  private async refreshAdminCache() {
    const configIds = this.configService.get<number[]>('bot.adminIds') || [];
    try {
      const dbAdmins = await this.usersService.findAdmins();
      this.adminCache = new Set([...configIds, ...dbAdmins.map((u) => u.telegramId)]);
    } catch {
      this.adminCache = new Set(configIds);
    }
  }

  private isAdmin(userId: number): boolean {
    const configIds = this.configService.get<number[]>('bot.adminIds') || [];
    return this.adminCache.has(userId) || configIds.includes(userId);
  }

  // ── Asosiy menyu ─────────────────────────────────────────────────
  @Command('admin')
  async onAdmin(@Ctx() ctx: Context) {
    if (!this.isAdmin(ctx.from.id)) {
      await ctx.reply('⛔ Sizda admin huquqi yo\'q.');
      return;
    }
    await ctx.reply('👨‍⚕️ *Admin panel*', {
      parse_mode: 'Markdown',
      ...adminMainKb(),
    });
  }

  @Action('adm:back')
  async onBack(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.delete(ctx.from.id);
    await ctx.editMessageText('👨‍⚕️ *Admin panel*', {
      parse_mode: 'Markdown',
      ...adminMainKb(),
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ── Broadcast ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  @Action('adm:broadcast')
  async onBroadcastStart(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const userCount = await this.usersService.count();
    adminSessions.set(ctx.from.id, { broadcastStep: 'enter_text' });

    await ctx.editMessageText(
      `📢 *Foydalanuvchilarga xabar yuborish*\n\n👥 Jami foydalanuvchilar: *${userCount}* ta\n\nYubormoqchi bo'lgan xabarni yozing:\n_(matn, rasm yoki video bo'lishi mumkin)_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')]]),
      },
    );
  }

  @Action('adm:bc:cancel')
  async onBroadcastCancel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    adminSessions.delete(ctx.from.id);
    await ctx.editMessageText('👨‍⚕️ *Admin panel*', {
      parse_mode: 'Markdown',
      ...adminMainKb(),
    });
  }

  @Action('adm:bc:confirm')
  async onBroadcastConfirm(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const sess = adminSessions.get(ctx.from.id);
    if (!sess?.broadcastText && !sess?.broadcastPhotoId) return;

    const users = await this.usersService.findAll();
    let sent = 0, failed = 0;

    await ctx.editMessageText(`📤 Yuborilmoqda... (0 / ${users.length})`);

    const botInfo = await this.bot.telegram.getMe();
    const bookingRow = [{ text: '📅 Qabulga yozilish', url: `https://t.me/${botInfo.username}?start=book` }];
    const customRows: any[][] = sess.broadcastCustomButtons?.length ? sess.broadcastCustomButtons : [];
    const finalKb = { reply_markup: { inline_keyboard: [...customRows, bookingRow] } };

    for (const user of users) {
      try {
        if (sess.broadcastPhotoId) {
          await this.bot.telegram.sendPhoto(user.telegramId, sess.broadcastPhotoId, {
            caption: sess.broadcastText || undefined,
            parse_mode: 'Markdown',
            ...finalKb,
          });
        } else {
          await this.bot.telegram.sendMessage(user.telegramId, sess.broadcastText!, {
            parse_mode: 'Markdown',
            ...finalKb,
          });
        }
        sent++;
      } catch {
        failed++;
      }

      if ((sent + failed) % 20 === 0) {
        try {
          await ctx.editMessageText(`📤 Yuborilmoqda... (${sent + failed} / ${users.length})`);
        } catch {}
      }
    }

    adminSessions.delete(ctx.from.id);
    await ctx.editMessageText(
      `✅ *Xabar yuborildi!*\n\n📨 Yuborildi: *${sent}* ta\n❌ Yuborilmadi: *${failed}* ta\n_(bloklagan yoki botni o'chirgan foydalanuvchilar)_`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );
  }

  // Broadcast uchun rasm
  @On('photo')
  async onAdminPhoto(@Ctx() ctx: Context, @Next() next: () => Promise<void>) {
    if (!this.isAdmin(ctx.from.id)) return next();

    const sess = adminSessions.get(ctx.from.id);
    if (sess?.broadcastStep !== 'enter_text') return next();

    const msg = ctx.message as any;
    const photos: any[] = msg.photo;
    const fileId = photos[photos.length - 1].file_id;
    const caption: string = msg.caption || '';
    const customButtons: any[][] = msg.reply_markup?.inline_keyboard ?? [];

    const userCount = await this.usersService.count();
    sess.broadcastPhotoId = fileId;
    sess.broadcastText = caption;
    sess.broadcastCustomButtons = customButtons;
    sess.broadcastStep = 'confirm';

    const confirmKb = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yuborish', 'adm:bc:confirm')],
      [Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')],
    ]);

    const btnNote = customButtons.length
      ? `\n🔗 Xabardagi ${customButtons.flat().length} ta button ham yuboriladi.`
      : '';

    await ctx.replyWithPhoto(fileId, { caption: caption || undefined });
    await ctx.reply(
      `📷 Rasm *${userCount}* ta foydalanuvchiga yuboriladi.${btnNote}\nTasdiqlaysizmi?`,
      { parse_mode: 'Markdown', ...confirmKb },
    );
  }

  // Barcha admin matn kiritish qadamlari
  @On('text')
  async onAdminText(@Ctx() ctx: Context, @Next() next: () => Promise<void>) {
    if (!this.isAdmin(ctx.from.id)) return next();

    const sess = adminSessions.get(ctx.from.id);
    if (!sess?.broadcastStep && !sess?.step) return next();

    const text = (ctx.message as any).text as string;
    if (text?.startsWith('/')) return next();

    // ── Qabul rad etish sababi ──
    if (sess.step === 'apt:reject' && sess.rejectAptId) {
      const aptId = sess.rejectAptId;
      const apt = await this.appointmentsService.findById(aptId);
      adminSessions.delete(ctx.from.id);

      if (apt) {
        await this.appointmentsService.cancel(aptId, text);
        if (apt.timeSlot) await this.timeSlotsService.freeSlot(apt.timeSlot.id);

        const [y, mo, d] = apt.timeSlot.date.split('-');
        try {
          await this.bot.telegram.sendMessage(
            apt.user.telegramId,
            `❌ *Qabulingiz rad etildi.*\n\n🦷 Xizmat: ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${apt.timeSlot.time}\n\n📝 Sabab: ${text}\n\nQaytadan yozilish uchun /start bosing.`,
            { parse_mode: 'Markdown' },
          );
        } catch {}

        await ctx.reply(`✅ Qabul #${aptId} rad etildi. Mijozga xabar yuborildi.`, {
          ...Markup.inlineKeyboard([[Markup.button.callback('⏳ Kutayotganlar', 'adm:pending'), Markup.button.callback('⬅️ Menyu', 'adm:back')]]),
        });
      } else {
        await ctx.reply('Qabul topilmadi.', {
          ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Menyu', 'adm:back')]]),
        });
      }
      return;
    }

    // ── Broadcast ──
    if (sess.broadcastStep === 'enter_text') {
      const userCount = await this.usersService.count();
      const msg = ctx.message as any;
      sess.broadcastText = text;
      sess.broadcastPhotoId = undefined;
      sess.broadcastCustomButtons = msg.reply_markup?.inline_keyboard ?? [];
      sess.broadcastStep = 'confirm';
      await ctx.reply(
        `📢 *Xabar ko'rinishi:*\n\n${text}\n\n━━━━━━━━━━━━━\n👥 *${userCount}* ta foydalanuvchiga yuboriladi.\nTasdiqlaysizmi?`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Yuborish', 'adm:bc:confirm')],
            [Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')],
          ]),
        },
      );
      return;
    }

    // ── Xizmatlar ──
    if (sess.step === 'svc:add:name') {
      sess.tempText = text;
      sess.step = 'svc:add:emoji';
      adminSessions.set(ctx.from.id, sess);
      await ctx.reply('😀 Emojini kiriting (masalan: 🦷 ✨ 🔬):', {
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]),
      });
      return;
    }

    if (sess.step === 'svc:add:emoji') {
      const svc = await this.servicesService.create(sess.tempText!, text.trim());
      adminSessions.delete(ctx.from.id);
      await ctx.reply(`✅ *${svc.emoji} ${svc.name}* xizmati qo'shildi!`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]),
      });
      return;
    }

    if (sess.step === 'svc:edit:name') {
      await this.servicesService.update(sess.editId!, { name: text });
      adminSessions.delete(ctx.from.id);
      const svc = await this.servicesService.findById(sess.editId!);
      await ctx.reply(`✅ Nom yangilandi: *${svc?.name}*`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]),
      });
      return;
    }

    if (sess.step === 'svc:edit:emoji') {
      await this.servicesService.update(sess.editId!, { emoji: text.trim() });
      adminSessions.delete(ctx.from.id);
      await ctx.reply(`✅ Emoji yangilandi: *${text.trim()}*`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]),
      });
      return;
    }

    // ── FAQ ──
    if (sess.step === 'faq:add:q') {
      sess.tempText = text;
      sess.step = 'faq:add:a';
      adminSessions.set(ctx.from.id, sess);
      await ctx.reply('💬 Javobni kiriting:', {
        ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]),
      });
      return;
    }

    if (sess.step === 'faq:add:a') {
      await this.faqService.create(sess.tempText!, text);
      adminSessions.delete(ctx.from.id);
      await ctx.reply('✅ Savol qo\'shildi!', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]),
      });
      return;
    }

    if (sess.step === 'faq:edit:q') {
      await this.faqService.update(sess.editId!, { question: text });
      adminSessions.delete(ctx.from.id);
      await ctx.reply('✅ Savol yangilandi!', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]),
      });
      return;
    }

    if (sess.step === 'faq:edit:a') {
      await this.faqService.update(sess.editId!, { answer: text });
      adminSessions.delete(ctx.from.id);
      await ctx.reply('✅ Javob yangilandi!', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]),
      });
      return;
    }

    // ── Admin qo'shish ──
    if (sess.step === 'admin:add') {
      const telegramId = parseInt(text.trim());
      if (isNaN(telegramId)) {
        await ctx.reply('❗ Noto\'g\'ri format. Faqat raqam kiriting (Telegram ID):');
        return;
      }

      const user = await this.usersService.findByTelegramId(telegramId);
      if (!user) {
        await ctx.reply(
          `⚠️ ID ${telegramId} topilmadi.\nFoydalanuvchi avval botni ishga tushirgan bo'lishi kerak.`,
          { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:admins')]]) },
        );
        return;
      }

      await this.usersService.setAdmin(telegramId, true);
      this.adminCache.add(telegramId);
      adminSessions.delete(ctx.from.id);

      const name = user.fullName ? ` (${user.fullName})` : '';
      await ctx.reply(`✅ Admin qo'shildi: \`${telegramId}\`${name}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('👮 Adminlar ro\'yxati', 'adm:admins')]]),
      });
      return;
    }

    // ── Klinika ma'lumotlari ──
    const clinicFields: Record<string, keyof import('../database/entities/clinic-settings.entity').ClinicSettings> = {
      'clinic:name': 'name',
      'clinic:address': 'address',
      'clinic:phone': 'phone',
      'clinic:telegram': 'telegram',
      'clinic:mapsUrl': 'mapsUrl',
      'clinic:tgUrl': 'tgUrl',
      'clinic:igUrl': 'igUrl',
    };
    if (sess.step && clinicFields[sess.step]) {
      await this.clinicSettingsService.update({ [clinicFields[sess.step]]: text });
      adminSessions.delete(ctx.from.id);
      await ctx.reply('✅ Saqlandi!', {
        ...Markup.inlineKeyboard([[Markup.button.callback('🏥 Klinika ma\'lumotlariga qaytish', 'adm:clinic')]]),
      });
      return;
    }

    return next();
  }

  // ── Mijozlar fikri ────────────────────────────────────────────────
  @Action('adm:reviews')
  async onReviews(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const [stats, reviews] = await Promise.all([
      this.reviewsService.getStats(),
      this.reviewsService.findAll(15),
    ]);

    if (!stats.total) {
      await ctx.editMessageText('💬 Hali hech qanday fikr yo\'q.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]),
      });
      return;
    }

    const stars = (n: number) => '⭐'.repeat(n) + '☆'.repeat(5 - n);

    let text = `💬 *Mijozlar fikri*\n\n📊 Jami: *${stats.total}* ta | O'rtacha: *${stats.avg}* ⭐\n\n`;
    for (const r of reviews) {
      const [y, m, d] = (r.appointmentDate || '').split('-');
      const dateStr = r.appointmentDate ? `${d}.${m}.${y}` : '';
      text += `${stars(r.rating)} *${r.clientName || 'Mijoz'}*`;
      if (dateStr) text += ` | ${dateStr}`;
      if (r.serviceName) text += `\n🦷 ${r.serviceName}`;
      if (r.comment) text += `\n💬 _${r.comment}_`;
      text += '\n\n';
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]),
    });
  }

  // ── Kutayotgan qabullar ───────────────────────────────────────────
  @Action('adm:pending')
  async onPending(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const apts = await this.appointmentsService.findPendingByAdmin();
    if (!apts.length) {
      await ctx.editMessageText('⏳ Tasdiq kutayotgan qabul yo\'q.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]),
      });
      return;
    }

    let text = `⏳ *Tasdiq kutayotganlar* (${apts.length} ta):\n\n`;
    const btns = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      text += `#${a.id} — ${d}.${mo}.${y} ${a.timeSlot.time} | ${a.clientName} | ${a.service.name}\n`;
      return [
        Markup.button.callback(`✅ #${a.id}`, `adm:apt:ok:${a.id}`),
        Markup.button.callback(`❌ #${a.id}`, `adm:apt:rej:${a.id}`),
      ];
    });
    btns.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
  }

  // ── Qabulni tasdiqlash ────────────────────────────────────────────
  @Action(/^adm:apt:ok:(\d+)$/)
  async onAptApprove(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const id = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }

    await this.appointmentsService.confirm(id);

    const [y, mo, d] = apt.timeSlot.date.split('-');
    await ctx.editMessageText(
      `✅ *Qabul #${id} tasdiqlandi!*\n\n🦷 ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n👤 ${apt.clientName}`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );

    try {
      await this.bot.telegram.sendMessage(
        apt.user.telegramId,
        `✅ *Qabulingiz tasdiqlandi!*\n\n🦷 Xizmat: ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${apt.timeSlot.time}\n👤 ${apt.clientName}\n\nKlinikamizga kuting! 😊`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
  }

  // ── Qabulni rad etish ─────────────────────────────────────────────
  @Action(/^adm:apt:rej:(\d+)$/)
  async onAptReject(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const id = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }

    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    if (msLeft <= 0) {
      await ctx.answerCbQuery('Qabul allaqachon yakunlangan!', { show_alert: true });
      return;
    }
    if (msLeft <= 30 * 60 * 1000) {
      await ctx.answerCbQuery('Qabulga 30 daqiqadan kam vaqt qoldi, bekor qilib bo\'lmaydi!', { show_alert: true });
      return;
    }

    adminSessions.set(ctx.from.id, { step: 'apt:reject', rejectAptId: id });

    await ctx.editMessageText(
      `❌ *Qabul #${id} rad etilmoqda...*\n\nRad etish sababini yozing:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🚫 Bekor qilish', 'adm:back')]]) },
    );
  }

  // ── Bugungi qabullar ─────────────────────────────────────────────
  @Action('adm:today')
  async onToday(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const list = await this.appointmentsService.findTodayAppointments();
    if (!list.length) {
      await ctx.editMessageText('📋 Bugun uchun qabul yo\'q.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]),
      });
      return;
    }

    const now = new Date();
    let text = `📋 *Bugungi qabullar:*\n\n`;
    for (const a of list) {
      text += `🕐 *${a.timeSlot.time}* — ${a.service.name}\n👤 ${a.clientName} | 📱 ${a.clientPhone}\n\n`;
    }
    const cancelBtns = list.map((a) => {
      const aptTime = new Date(`${a.timeSlot.date}T${a.timeSlot.time}:00+05:00`);
      const msLeft = aptTime.getTime() - now.getTime();
      if (msLeft <= 0) {
        return Markup.button.callback(`✅ ${fmtTime(a.timeSlot.time)} yakunlandi`, 'adm:noop');
      } else if (msLeft <= 30 * 60 * 1000) {
        return Markup.button.callback(`⏳ ${fmtTime(a.timeSlot.time)} (30 daq qoldi)`, 'adm:noop');
      }
      return Markup.button.callback(`❌ ${fmtTime(a.timeSlot.time)} bekor`, `adm:cancel:${a.id}`);
    });
    const btns: any[][] = [];
    for (let i = 0; i < cancelBtns.length; i += 2) {
      btns.push(cancelBtns.slice(i, i + 2));
    }
    btns.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
  }

  // ── Haftalik jadval ───────────────────────────────────────────────
  @Action('adm:week')
  async onWeek(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    await this.renderWeek(ctx);
  }

  private async renderWeek(ctx: Context) {
    const list = await this.appointmentsService.findWeekAppointments();
    if (!list.length) {
      await ctx.editMessageText('📅 Kelgusi hafta uchun qabul yo\'q.', {
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]),
      });
      return;
    }

    const rows: any[][] = [];
    let prevDate = '';
    for (const a of list) {
      const date = a.timeSlot?.date;
      if (date !== prevDate) {
        rows.push([Markup.button.callback(`📆 ${fmtDate(date)}`, 'adm:week:ig')]);
        prevDate = date;
      }
      rows.push([Markup.button.callback(
        `🕐 ${fmtTime(a.timeSlot.time)}  ${a.service.name} — ${a.clientName}`,
        `adm:wapt:${a.id}`,
      )]);
    }
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);

    await ctx.editMessageText(`📅 *Haftalik jadval* (${list.length} ta qabul):`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  @Action('adm:week:ig')
  async onWeekIgnore(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
  }

  @Action(/^adm:wapt:(\d+)$/)
  async onWeekAptDetail(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;

    const id = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }

    const [y, mo, d] = apt.timeSlot.date.split('-');
    const text =
      `📋 *Qabul #${apt.id}*\n\n` +
      `🦷 Xizmat: ${apt.service.name}\n` +
      `📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n` +
      `👤 ${apt.clientName}\n` +
      `📱 ${apt.clientPhone}`;

    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();

    let actionBtn: any;
    if (msLeft <= 0) {
      actionBtn = Markup.button.callback('✅ Qabul yakunlangan', 'adm:noop');
    } else if (msLeft <= 30 * 60 * 1000) {
      actionBtn = Markup.button.callback('⏳ 30 daqiqadan kam qoldi', 'adm:noop');
    } else {
      actionBtn = Markup.button.callback('❌ Bekor qilish', `adm:apt:rej:${apt.id}`);
    }

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [actionBtn, Markup.button.callback('⬅️ Jadvalga qaytish', 'adm:week')],
      ]),
    });
  }

  // ── Statistika ────────────────────────────────────────────────────
  @Action('adm:stats')
  async onStats(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const [stats, users] = await Promise.all([
      this.appointmentsService.getStats(),
      this.usersService.count(),
    ]);
    await ctx.editMessageText(
      `📊 *Statistika:*\n\n👥 Foydalanuvchilar: *${users}*\n\n📋 Jami: *${stats.total}*\n✅ Tasdiqlangan: *${stats.confirmed}*\n🔴 Bekor: *${stats.cancelled}*\n✔️ Yakunlangan: *${stats.completed}*`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );
  }

  @Action('adm:noop')
  async onAdmNoop(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
  }

  // ── Qabulni bekor qilish ──────────────────────────────────────────
  @Action(/^adm:cancel:(\d+)$/)
  async onCancelAppointment(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const apt = await this.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }

    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    if (msLeft <= 0) {
      await ctx.answerCbQuery('Qabul allaqachon yakunlangan!', { show_alert: true });
      return;
    }
    if (msLeft <= 30 * 60 * 1000) {
      await ctx.answerCbQuery('Qabulga 30 daqiqadan kam vaqt qoldi, bekor qilib bo\'lmaydi!', { show_alert: true });
      return;
    }

    await this.appointmentsService.cancel(id);
    if (apt.timeSlot) await this.timeSlotsService.freeSlot(apt.timeSlot.id);
    try {
      await this.bot.telegram.sendMessage(
        apt.user.telegramId,
        `❌ *Qabulingiz bekor qilindi*\n\n🦷 ${apt.service.name}\n📅 ${fmtDate(apt.timeSlot?.date)} soat ${apt.timeSlot?.time}`,
        { parse_mode: 'Markdown' },
      );
    } catch {}
    await ctx.editMessageText(`✅ Qabul #${id} bekor qilindi.`, {
      ...Markup.inlineKeyboard([[Markup.button.callback('📋 Bugungi qabullar', 'adm:today')]]),
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ── Ish vaqti sozlash ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  @Action('adm:schedule')
  async onSchedule(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const schedule = await this.workScheduleService.get();
    await ctx.editMessageText(
      buildScheduleSummary(schedule),
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📅 Ish kunlarini sozla', 'adm:sch:cal'), Markup.button.callback('🕐 Ish soatlarini sozla', 'adm:sch:hours')],
          [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
        ]),
      },
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // ── Kalendar (oy ko'rinishida ish kunlarini belgilash) ────────────
  // ══════════════════════════════════════════════════════════════════

  @Action('adm:sch:cal')
  async onShowCalendar(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const now = new Date();
    await this.renderAdminCalendar(ctx, now.getFullYear(), now.getMonth(), true);
  }

  @Action(/^adm:sch:cal:p:(\d{4}):(\d{1,2})$/)
  async onCalPrev(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    // Callback da maqsad oy allaqachon hisoblangan — o'zgartirmasdan ishlatamiz
    const year = parseInt((ctx as any).match[1]);
    const month = parseInt((ctx as any).match[2]);
    await this.renderAdminCalendar(ctx, year, month, false);
  }

  @Action(/^adm:sch:cal:n:(\d{4}):(\d{1,2})$/)
  async onCalNext(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const year = parseInt((ctx as any).match[1]);
    const month = parseInt((ctx as any).match[2]);
    await this.renderAdminCalendar(ctx, year, month, false);
  }

  @Action(/^adm:sch:cal:t:(\d{4}-\d{2}-\d{2})$/)
  async onToggleDate(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const dateStr = (ctx as any).match[1];
    const nowOn = await this.workScheduleService.toggleDate(dateStr);
    await this.timeSlotsService.regenerateFutureSlots();

    const [y, m] = dateStr.split('-').map(Number);
    await this.renderAdminCalendar(ctx, y, m - 1, false);
  }

  @Action('adm:sch:cal:ig')
  async onCalIgnore(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
  }

  private async renderAdminCalendar(
    ctx: Context,
    year: number,
    month: number,
    isNew: boolean,
  ) {
    const schedule = await this.workScheduleService.get();
    const kb = await buildAdminCalendarKeyboard(year, month, schedule);
    const text = `📅 *Ish kunlari — ${UZ_MONTHS[month]} ${year}*\n\n✅ = ish kuni  🔴 = dam olish\n_(sanaga bosib o'zgartiring)_`;

    if (isNew) {
      await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
    } else {
      try {
        await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb });
      } catch {}
    }
  }

  // ══════════════════════════════════════════════════════════════════
  // ── Soatlar muharriri ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  @Action('adm:sch:hours')
  async onEditHours(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const schedule = await this.workScheduleService.get();
    adminSessions.set(ctx.from.id, { hours: [...schedule.workHours] });
    await ctx.editMessageText(
      '🕐 *Ish soatlarini tanlang:*\n_(bosing — yoqish/o\'chirish)_',
      { parse_mode: 'Markdown', ...buildHoursKeyboard([...schedule.workHours]) },
    );
  }

  @Action(/^adm:sch:hour:(\d{2}:\d{2})$/)
  async onToggleHour(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const hour = (ctx as any).match[1];
    const sess = adminSessions.get(ctx.from.id) || {};
    const hours = sess.hours || [];
    sess.hours = hours.includes(hour) ? hours.filter((h) => h !== hour) : [...hours, hour].sort();
    adminSessions.set(ctx.from.id, sess);
    await ctx.editMessageReplyMarkup(buildHoursKeyboard(sess.hours).reply_markup);
  }

  @Action('adm:sch:hours:save')
  async onSaveHours(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const sess = adminSessions.get(ctx.from.id) || {};
    if (!sess.hours?.length) {
      await ctx.answerCbQuery('⚠️ Kamida 1 soat tanlang!', { show_alert: true });
      return;
    }
    await this.workScheduleService.saveWorkHours(sess.hours);
    await this.timeSlotsService.regenerateFutureSlots();
    adminSessions.delete(ctx.from.id);

    const schedule = await this.workScheduleService.get();
    await ctx.editMessageText(`✅ *Ish soatlari saqlandi!*\n\n${buildScheduleSummary(schedule)}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📅 Kunlarni sozla', 'adm:sch:cal'), Markup.button.callback('🕐 Soatlarni sozla', 'adm:sch:hours')],
        [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
      ]),
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // ── Sozlamalar ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════

  @Action('adm:settings')
  async onSettings(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    await ctx.editMessageText('⚙️ *Sozlamalar*\n\nQaysi bo\'limni boshqarmoqchisiz?', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🦷 Xizmatlar', 'adm:svc:list'), Markup.button.callback('❓ FAQ', 'adm:faq:list')],
        [Markup.button.callback('🏥 Klinika ma\'lumotlari', 'adm:clinic'), Markup.button.callback('👮 Adminlar', 'adm:admins')],
        [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
      ]),
    });
  }

  // ── Xizmatlar CRUD ───────────────────────────────────────────────

  @Action('adm:svc:list')
  async onSvcList(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.delete(ctx.from.id);
    const svcs = await this.servicesService.findAllAdmin();
    const rows = svcs.map((s) => [
      Markup.button.callback(`${s.emoji || '🦷'} ${s.name}${s.isActive ? '' : ' ⛔'}`, `adm:svc:${s.id}`),
    ]);
    rows.push([Markup.button.callback('➕ Yangi xizmat qo\'shish', 'adm:svc:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`🦷 *Xizmatlar* (${svcs.length} ta)`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  @Action(/^adm:svc:(\d+)$/)
  async onSvcDetail(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await this.servicesService.findById(id);
    if (!svc) return;
    await ctx.editMessageText(
      `🦷 *${svc.emoji || ''} ${svc.name}*\n\nHolati: ${svc.isActive ? '✅ Faol' : '⛔ Nofaol'}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Nomini o\'zgartir', `adm:svc:en:${id}`), Markup.button.callback('😀 Emojini o\'zgartir', `adm:svc:ee:${id}`)],
          [Markup.button.callback(svc.isActive ? '⛔ Nofaol qilish' : '✅ Faol qilish', `adm:svc:tgl:${id}`), Markup.button.callback('🗑 O\'chirish', `adm:svc:del:${id}`)],
          [Markup.button.callback('⬅️ Orqaga', 'adm:svc:list')],
        ]),
      },
    );
  }

  @Action('adm:svc:add')
  async onSvcAdd(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'svc:add:name' });
    await ctx.editMessageText('🦷 Yangi xizmat nomini kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]),
    });
  }

  @Action(/^adm:svc:en:(\d+)$/)
  async onSvcEditName(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    adminSessions.set(ctx.from.id, { step: 'svc:edit:name', editId: id });
    await ctx.editMessageText('✏️ Yangi nomni kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]),
    });
  }

  @Action(/^adm:svc:ee:(\d+)$/)
  async onSvcEditEmoji(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    adminSessions.set(ctx.from.id, { step: 'svc:edit:emoji', editId: id });
    await ctx.editMessageText('😀 Yangi emojini kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]),
    });
  }

  @Action(/^adm:svc:tgl:(\d+)$/)
  async onSvcToggle(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await this.servicesService.findById(id);
    if (!svc) return;
    await this.servicesService.update(id, { isActive: !svc.isActive });
    await ctx.answerCbQuery(svc.isActive ? '⛔ Nofaol qilindi' : '✅ Faol qilindi', { show_alert: true });
    // Refresh detail
    const updated = await this.servicesService.findById(id);
    await ctx.editMessageText(
      `🦷 *${updated!.emoji || ''} ${updated!.name}*\n\nHolati: ${updated!.isActive ? '✅ Faol' : '⛔ Nofaol'}`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Nomini o\'zgartir', `adm:svc:en:${id}`), Markup.button.callback('😀 Emojini o\'zgartir', `adm:svc:ee:${id}`)],
          [Markup.button.callback(updated!.isActive ? '⛔ Nofaol qilish' : '✅ Faol qilish', `adm:svc:tgl:${id}`), Markup.button.callback('🗑 O\'chirish', `adm:svc:del:${id}`)],
          [Markup.button.callback('⬅️ Orqaga', 'adm:svc:list')],
        ]),
      },
    );
  }

  @Action(/^adm:svc:del:(\d+)$/)
  async onSvcDelConfirm(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await this.servicesService.findById(id);
    if (!svc) return;
    await ctx.editMessageText(
      `🗑 *${svc.name}* xizmatini o'chirishni tasdiqlaysizmi?\n\n⚠️ Bu amalni qaytarib bo'lmaydi!`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Ha, o\'chirish', `adm:svc:dok:${id}`)],
          [Markup.button.callback('❌ Yo\'q', `adm:svc:${id}`)],
        ]),
      },
    );
  }

  @Action(/^adm:svc:dok:(\d+)$/)
  async onSvcDelOk(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    await this.servicesService.remove(id);
    const svcs = await this.servicesService.findAllAdmin();
    const rows = svcs.map((s) => [
      Markup.button.callback(`${s.emoji || '🦷'} ${s.name}${s.isActive ? '' : ' ⛔'}`, `adm:svc:${s.id}`),
    ]);
    rows.push([Markup.button.callback('➕ Yangi xizmat qo\'shish', 'adm:svc:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`✅ O\'chirildi!\n\n🦷 *Xizmatlar* (${svcs.length} ta)`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  // ── FAQ CRUD ─────────────────────────────────────────────────────

  @Action('adm:faq:list')
  async onFaqList(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.delete(ctx.from.id);
    const faqs = await this.faqService.findAllAdmin();
    const rows = faqs.map((f) => [
      Markup.button.callback(
        f.question.length > 40 ? f.question.slice(0, 40) + '…' : f.question,
        `adm:faq:${f.id}`,
      ),
    ]);
    rows.push([Markup.button.callback('➕ Yangi savol qo\'shish', 'adm:faq:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`❓ *Tez-tez savollar* (${faqs.length} ta)`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  @Action(/^adm:faq:(\d+)$/)
  async onFaqDetail(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const faq = await this.faqService.findById(id);
    if (!faq) return;
    const preview = faq.answer.length > 100 ? faq.answer.slice(0, 100) + '…' : faq.answer;
    await ctx.editMessageText(
      `❓ <b>${esc(faq.question)}</b>\n\n💬 ${esc(preview)}`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✏️ Savolni o\'zgartir', `adm:faq:eq:${id}`), Markup.button.callback('✏️ Javobni o\'zgartir', `adm:faq:ea:${id}`)],
          [Markup.button.callback('🗑 O\'chirish', `adm:faq:del:${id}`), Markup.button.callback('⬅️ Orqaga', 'adm:faq:list')],
        ]),
      },
    );
  }

  @Action('adm:faq:add')
  async onFaqAdd(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'faq:add:q' });
    await ctx.editMessageText('❓ Yangi savolni kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]),
    });
  }

  @Action(/^adm:faq:eq:(\d+)$/)
  async onFaqEditQ(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    adminSessions.set(ctx.from.id, { step: 'faq:edit:q', editId: id });
    await ctx.editMessageText('✏️ Yangi savolni kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]),
    });
  }

  @Action(/^adm:faq:ea:(\d+)$/)
  async onFaqEditA(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    adminSessions.set(ctx.from.id, { step: 'faq:edit:a', editId: id });
    await ctx.editMessageText('✏️ Yangi javobni kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]),
    });
  }

  @Action(/^adm:faq:del:(\d+)$/)
  async onFaqDelConfirm(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const faq = await this.faqService.findById(id);
    if (!faq) return;
    await ctx.editMessageText(
      `🗑 Bu savolni o'chirishni tasdiqlaysizmi?\n\n*${faq.question}*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Ha, o\'chirish', `adm:faq:dok:${id}`)],
          [Markup.button.callback('❌ Yo\'q', `adm:faq:${id}`)],
        ]),
      },
    );
  }

  @Action(/^adm:faq:dok:(\d+)$/)
  async onFaqDelOk(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    await this.faqService.remove(id);
    const faqs = await this.faqService.findAllAdmin();
    const rows = faqs.map((f) => [
      Markup.button.callback(
        f.question.length > 40 ? f.question.slice(0, 40) + '…' : f.question,
        `adm:faq:${f.id}`,
      ),
    ]);
    rows.push([Markup.button.callback('➕ Yangi savol qo\'shish', 'adm:faq:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`✅ O\'chirildi!\n\n❓ *Tez-tez savollar* (${faqs.length} ta)`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  // ── Klinika ma'lumotlari ─────────────────────────────────────────

  @Action('adm:clinic')
  async onClinic(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.delete(ctx.from.id);
    await this.showClinicSettings(ctx, false);
  }

  private async showClinicSettings(ctx: Context, isNew: boolean) {
    const c = await this.clinicSettingsService.get();
    const text =
      `🏥 <b>Klinika ma'lumotlari</b>\n\n` +
      `📛 Nomi: ${esc(c.name)}\n` +
      `📍 Manzil: ${esc(c.address)}\n` +
      `📱 Telefon: ${esc(c.phone)}\n` +
      `💬 Telegram: ${esc(c.telegram)}\n` +
      `🗺 Xarita: ${esc(c.mapsUrl)}\n\n` +
      `🌐 <b>Ijtimoiy tarmoqlar:</b>\n` +
      `Telegram: ${esc(c.tgUrl)}\n` +
      `Instagram: ${esc(c.igUrl)}`;
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📛 Nomini o\'zgartir', 'adm:cl:name'), Markup.button.callback('📍 Manzilni o\'zgartir', 'adm:cl:addr')],
      [Markup.button.callback('📱 Telefonni o\'zgartir', 'adm:cl:phone'), Markup.button.callback('💬 Telegramni o\'zgartir', 'adm:cl:tg')],
      [Markup.button.callback('🗺 Xarita linkini o\'zgartir', 'adm:cl:maps')],
      [Markup.button.callback('✈️ Telegram link', 'adm:cl:tgurl'), Markup.button.callback('📷 Instagram link', 'adm:cl:igurl')],
      [Markup.button.callback('⬅️ Orqaga', 'adm:settings')],
    ]);
    if (isNew) {
      await ctx.reply(text, { parse_mode: 'HTML', ...kb });
    } else {
      await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
    }
  }

  @Action('adm:cl:name')
  async onClinicEditName(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:name' });
    await ctx.editMessageText('📛 Yangi klinika nomini kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:addr')
  async onClinicEditAddr(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:address' });
    await ctx.editMessageText('📍 Yangi manzilni kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:phone')
  async onClinicEditPhone(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:phone' });
    await ctx.editMessageText('📱 Yangi telefon raqamini kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:tg')
  async onClinicEditTg(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:telegram' });
    await ctx.editMessageText('💬 Yangi Telegram username kiriting (masalan: @smiledentaluz):', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:maps')
  async onClinicEditMaps(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:mapsUrl' });
    await ctx.editMessageText('🗺 Yangi Google Maps linkini kiriting:', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:tgurl')
  async onClinicEditTgUrl(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:tgUrl' });
    await ctx.editMessageText('✈️ Telegram kanal linkini kiriting (masalan: https://t.me/dentist_nargiss):', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  @Action('adm:cl:igurl')
  async onClinicEditIgUrl(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'clinic:igUrl' });
    await ctx.editMessageText('📷 Instagram sahifa linkini kiriting (masalan: https://www.instagram.com/dentist_nargiss):', {
      ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]),
    });
  }

  // ── Adminlar boshqaruvi ───────────────────────────────────────────

  @Action('adm:admins')
  async onAdmins(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.delete(ctx.from.id);
    await this.showAdmins(ctx);
  }

  private async showAdmins(ctx: Context) {
    const configIds: number[] = this.configService.get<number[]>('bot.adminIds') || [];
    const dbAdmins = await this.usersService.findAdmins();

    let text = '👮 *Adminlar ro\'yxati:*\n\n';
    const rows: any[][] = [];

    // Config'dan asosiy adminlar (o'chirib bo'lmaydi)
    for (const id of configIds) {
      text += `🔒 \`${id}\` — asosiy admin\n`;
    }

    // DBdan qo'shilgan adminlar
    const dbOnly = dbAdmins.filter((u) => !configIds.includes(u.telegramId));
    for (const u of dbOnly) {
      const label = u.fullName ? `${u.fullName} (${u.telegramId})` : `${u.telegramId}`;
      text += `👤 \`${u.telegramId}\`${u.fullName ? ' — ' + u.fullName : ''}\n`;
      rows.push([Markup.button.callback(`❌ O'chirish: ${label}`, `adm:adm:del:${u.telegramId}`)]);
    }

    rows.push([Markup.button.callback('➕ Admin qo\'shish', 'adm:adm:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);

    await ctx.editMessageText(text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(rows),
    });
  }

  @Action('adm:adm:add')
  async onAdminAdd(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    adminSessions.set(ctx.from.id, { step: 'admin:add' });
    await ctx.editMessageText(
      '👮 Yangi admin Telegram ID sini kiriting:\n_(Foydalanuvchi avval botni ishga tushirgan bo\'lishi kerak)_',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:admins')]]) },
    );
  }

  @Action(/^adm:adm:del:(\d+)$/)
  async onAdminDel(@Ctx() ctx: Context) {
    await ctx.answerCbQuery();
    if (!this.isAdmin(ctx.from.id)) return;
    const telegramId = parseInt((ctx as any).match[1]);
    await this.usersService.setAdmin(telegramId, false);
    this.adminCache.delete(telegramId);
    await this.showAdmins(ctx);
  }
}

// ══════════════════════════════════════════════════════════════════
// Keyboard builders
// ══════════════════════════════════════════════════════════════════

function esc(s: string | null | undefined): string {
  return (s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function adminMainKb() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📋 Bugungi qabullar', 'adm:today'),
      Markup.button.callback('📅 Haftalik jadval', 'adm:week'),
    ],
    [
      Markup.button.callback('📊 Statistika', 'adm:stats'),
      Markup.button.callback('💬 Mijozlar fikri', 'adm:reviews'),
    ],
    [
      Markup.button.callback('⏰ Ish vaqtini sozla', 'adm:schedule'),
      Markup.button.callback('⚙️ Sozlamalar', 'adm:settings'),
    ],
    [Markup.button.callback('📢 Foydalanuvchilarga xabar yuborish', 'adm:broadcast')],
  ]);
}

async function buildAdminCalendarKeyboard(year: number, month: number, schedule: any) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const rows: any[][] = [];

  // Maqsad oyni to'g'ri hisoblash (handler da qayta +/-1 qilinmaydi)
  let pYear = year, pMonth = month - 1;
  if (pMonth < 0) { pMonth = 11; pYear--; }
  let nYear = year, nMonth = month + 1;
  if (nMonth > 11) { nMonth = 0; nYear++; }

  rows.push([
    Markup.button.callback('◀️', `adm:sch:cal:p:${pYear}:${pMonth}`),
    Markup.button.callback(`${UZ_MONTHS[month]} ${year}`, 'adm:sch:cal:ig'),
    Markup.button.callback('▶️', `adm:sch:cal:n:${nYear}:${nMonth}`),
  ]);

  // Hafta kunlari sarlavhasi
  rows.push(UZ_WEEKDAYS.map((d) => Markup.button.callback(d, 'adm:sch:cal:ig')));

  // PostgreSQL JSON ba'zan string qaytarishi mumkin — Number ga majburamiz
  const workDays: number[] = (schedule.workDays || []).map(Number);
  const blockedDates: string[] = schedule.blockedDates || [];
  const extraWorkDates: string[] = schedule.extraWorkDates || [];

  // Kunlarni hisoblash
  const dateMap: Record<string, boolean> = {};
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month, d);
    const dow = dt.getDay() === 0 ? 7 : dt.getDay();

    let working: boolean;
    if (extraWorkDates.includes(dateStr)) working = true;
    else if (blockedDates.includes(dateStr)) working = false;
    else working = workDays.includes(dow);

    dateMap[d] = working;
  }

  let dayRow: any[] = [];
  for (let i = 0; i < startDow; i++) {
    dayRow.push(Markup.button.callback(' ', 'adm:sch:cal:ig'));
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month, d);
    const isPast = dt < today;
    const isWorking = dateMap[d];

    let label: string;
    let cbData: string;

    if (isPast) {
      label = String(d);
      cbData = 'adm:sch:cal:ig';
    } else {
      label = isWorking ? `✅${d}` : `🔴${d}`;
      cbData = `adm:sch:cal:t:${dateStr}`;
    }

    dayRow.push(Markup.button.callback(label, cbData));
    if (dayRow.length === 7) { rows.push(dayRow); dayRow = []; }
  }

  while (dayRow.length > 0 && dayRow.length < 7) {
    dayRow.push(Markup.button.callback(' ', 'adm:sch:cal:ig'));
  }
  if (dayRow.length) rows.push(dayRow);

  rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:schedule')]);

  return Markup.inlineKeyboard(rows);
}

function buildHoursKeyboard(activeHours: string[]) {
  const rows: any[][] = [];
  let row: any[] = [];
  for (const h of ALL_HOURS) {
    const label = h.endsWith(':00') ? `✅ ${parseInt(h)}:00` : `✅ ${parseInt(h)}:30`;
    const inactive = h.endsWith(':00') ? `☐ ${parseInt(h)}:00` : `☐ ${parseInt(h)}:30`;
    row.push(Markup.button.callback(
      activeHours.includes(h) ? label : inactive,
      `adm:sch:hour:${h}`,
    ));
    if (row.length === 4) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  rows.push([Markup.button.callback('💾 Saqlash', 'adm:sch:hours:save')]);
  rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:schedule')]);
  return Markup.inlineKeyboard(rows);
}

function buildScheduleSummary(schedule: any): string {
  const DAYS = [
    { num: 1, label: 'Du' }, { num: 2, label: 'Se' }, { num: 3, label: 'Ch' },
    { num: 4, label: 'Pa' }, { num: 5, label: 'Ju' }, { num: 6, label: 'Sh' },
    { num: 7, label: 'Ya' },
  ];
  const dayLabels = DAYS.filter((d) => schedule.workDays?.includes(d.num)).map((d) => d.label);
  const blocked = schedule.blockedDates?.length || 0;
  const extra = schedule.extraWorkDates?.length || 0;
  return `⏰ *Hozirgi ish vaqti:*\n\n📅 Asosiy kunlar: *${dayLabels.join(', ')}*\n🕐 Soatlar: *${(schedule.workHours || []).join(' | ')}*\n\n🔴 Maxsus dam olish: *${blocked} kun*\n✅ Maxsus ish kuni: *${extra} kun*`;
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}
