import { Telegraf, Markup } from 'telegraf';
import { Clinic } from '../database/entities/clinic.entity';
import { AppointmentStatus } from '../database/entities/appointment.entity';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { FaqService } from '../faq/faq.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { ClinicsService } from '../clinics/clinics.service';
import { PaymentsService } from '../payments/payments.service';
import { PlansService } from '../plans/plans.service';
import { PromosService } from '../promos/promos.service';
import {
  mainMenuKeyboard, cancelKeyboard, confirmKeyboard,
  nameStepKeyboard, phoneStepKeyboard,
} from '../bot/keyboards/main-menu.keyboard';
import {
  buildCalendarKeyboard, buildTimeKeyboard, buildServicesKeyboard,
  ScheduleInfo, fmtTime,
} from '../bot/keyboards/calendar.keyboard';

export interface BotServices {
  usersService: UsersService;
  servicesService: ServicesService;
  appointmentsService: AppointmentsService;
  timeSlotsService: TimeSlotsService;
  workScheduleService: WorkScheduleService;
  faqService: FaqService;
  clinicSettingsService: ClinicSettingsService;
  reviewsService: ReviewsService;
  clinicsService: ClinicsService;
  paymentsService: PaymentsService;
  plansService: PlansService;
  promosService: PromosService;
}

interface UserSession {
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
  payStep?: string;
  payPlanId?: number;
  payPlanName?: string;
  payAmount?: number;
}

interface ReviewSession {
  appointmentId: number;
  rating: number;
  serviceName: string;
  clientName: string;
  appointmentDate: string;
}

// Module-level session maps keyed by `${clinicId}:${userId}`
const userSessions = new Map<string, UserSession>();
const adminSessionMap = new Map<string, AdminSession>();
const reviewSessionMap = new Map<string, ReviewSession>();

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

export function setupBotHandlers(
  bot: Telegraf,
  clinicId: number,
  clinic: Clinic,
  services: BotServices,
  appUrl: string,
  superAdminIds: number[] = [],
  adminOnly = false,
) {
  const adminIds = new Set<number>(clinic.adminIds);
  const isAdmin = (userId: number) => adminIds.has(userId);

  const uKey = (userId: number) => `${clinicId}:${userId}`;

  const getUSess = (userId: number): UserSession => {
    const k = uKey(userId);
    if (!userSessions.has(k)) userSessions.set(k, {});
    return userSessions.get(k)!;
  };
  const clearUSess = (userId: number) => userSessions.set(uKey(userId), {});

  const getASess = (userId: number): AdminSession => {
    const k = uKey(userId);
    if (!adminSessionMap.has(k)) adminSessionMap.set(k, {});
    return adminSessionMap.get(k)!;
  };
  const setASess = (userId: number, sess: AdminSession) => adminSessionMap.set(uKey(userId), sess);
  const delASess = (userId: number) => adminSessionMap.delete(uKey(userId));

  const getScheduleInfo = async (): Promise<ScheduleInfo> => {
    const s = await services.workScheduleService.get(clinicId);
    return {
      workDays: (s.workDays || []).map(Number),
      blockedDates: s.blockedDates || [],
      extraWorkDates: s.extraWorkDates || [],
    };
  };

  // ── /admin buyrug'i URL (used by both /admin command and adm:back) ─
  const miniAppUrl = appUrl ? `${appUrl}/admin/?clinicId=${clinicId}` : undefined;

  // ── /start ────────────────────────────────────────────────────────
  bot.start(async (ctx) => {
    if (adminOnly) {
      if (!isAdmin(ctx.from.id)) {
        await ctx.reply('⛔ Bu bot faqat klinika admini uchun mo\'ljallangan.');
        return;
      }
      await ctx.reply('👨‍⚕️ *Admin panel*', { parse_mode: 'Markdown', ...adminMainKb(miniAppUrl) });
      return;
    }
    const from = ctx.from;
    await services.usersService.findOrCreate(from.id, clinicId, from.username);
    clearUSess(from.id);

    const param = (ctx.message as any)?.text?.split(' ')[1];
    const clinicSettings = await services.clinicSettingsService.get(clinicId);

    const socialLine = buildSocialLine(clinicSettings);
    await ctx.reply(
      `👋 Assalomu alaykum, *${from.first_name}*!\n\n` +
      `*${escMd(clinicSettings?.name || 'Klinika')}* qabuliga yozilish botiga xush kelibsiz!\n\n` +
      `✨ Chiroyli tabassum — bu sizning eng yaxshi bezagingiz!\n\n` +
      (socialLine ? `Yangiliklardan xabardor bo'lish uchun:\n${socialLine}\n\n` : '') +
      `👇 Quyida kerakli bo\'limni tanlang:`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard() },
    );

    if (param === 'book') {
      const svcList = await services.servicesService.findAll(clinicId);
      const sess = getUSess(from.id);
      sess.step = 'choose_service';
      await ctx.reply('🦷 Qaysi xizmatga yozilmoqchisiz?', buildServicesKeyboard(svcList));
    }
  });

  if (!adminOnly) {

  // ── Bosh menyu ────────────────────────────────────────────────────
  bot.hears('🏠 Bosh menyu', async (ctx) => {
    clearUSess(ctx.from.id);
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  });

  // ── Xizmatlar ─────────────────────────────────────────────────────
  bot.hears('💼 Xizmatlar', async (ctx) => {
    const svcList = await services.servicesService.findAll(clinicId);
    let text = '💼 *Bizning xizmatlar:*\n\n';
    for (const s of svcList) {
      text += `${s.emoji || '🦷'} *${s.name}*\n   ${s.description || ''}\n\n`;
    }
    await ctx.reply(text, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
  });

  // ── Review ────────────────────────────────────────────────────────
  bot.action(/^review:r:(\d+):(\d)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const rating = parseInt((ctx as any).match[2]);
    const apt = await services.appointmentsService.findById(aptId);
    reviewSessionMap.set(uKey(ctx.from.id), {
      appointmentId: aptId,
      rating,
      serviceName: apt?.service?.name || '',
      clientName: apt?.clientName || '',
      appointmentDate: apt?.timeSlot?.date || '',
    });
    const stars = '⭐'.repeat(rating);
    await ctx.editMessageText(
      `${stars} *${rating}/5* baho berdingiz!\n\n📝 Fikringizni yozing:\n_(ixtiyoriy)_`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⏭ O\'tkazib yuborish', `review:skip:${aptId}`)]]),
      },
    );
  });

  bot.action(/^review:skip:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const rsess = reviewSessionMap.get(uKey(ctx.from.id));
    await services.reviewsService.create(clinicId, {
      telegramId: ctx.from.id,
      rating: rsess?.rating || 5,
      serviceName: rsess?.serviceName,
      clientName: rsess?.clientName,
      appointmentDate: rsess?.appointmentDate,
    });
    reviewSessionMap.delete(uKey(ctx.from.id));
    await ctx.editMessageText('✅ *Fikringiz uchun rahmat!*\n\nBu bizni yanada yaxshilashga yordam beradi. 🙏', { parse_mode: 'Markdown' });
  });

  // ── FAQ ───────────────────────────────────────────────────────────
  bot.hears('❓ Tez-tez so\'raladigan savollar', async (ctx) => {
    const faqs = await services.faqService.findAll(clinicId);
    await ctx.reply(
      '❓ *Tez-tez so\'raladigan savollar*\n\nQiziqtirgan savolni tanlang:',
      { parse_mode: 'Markdown', ...buildFaqListKeyboard(faqs) },
    );
  });

  bot.action(/^faq:show:(\d+)$/, async (ctx) => {
    const id = parseInt((ctx as any).match[1]);
    const item = await services.faqService.findById(id);
    if (!item) { await ctx.answerCbQuery(); return; }
    await ctx.editMessageText(
      `<b>${escHtml(item.question)}</b>\n\n${escHtml(item.answer)}`,
      {
        parse_mode: 'HTML',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('⬅️ Savollarga qaytish', 'faq:list')]]).reply_markup,
      },
    );
    await ctx.answerCbQuery();
  });

  bot.action('faq:list', async (ctx) => {
    const faqs = await services.faqService.findAll(clinicId);
    await ctx.editMessageText(
      '❓ *Tez-tez so\'raladigan savollar*\n\nQiziqtirgan savolni tanlang:',
      { parse_mode: 'Markdown', reply_markup: buildFaqListKeyboard(faqs).reply_markup },
    );
    await ctx.answerCbQuery();
  });

  // ── Manzil ────────────────────────────────────────────────────────
  bot.hears('📍 Manzil', async (ctx) => {
    const c = await services.clinicSettingsService.get(clinicId);
    const keyboard = c?.mapsUrl
      ? Markup.inlineKeyboard([[Markup.button.url('📍 Xaritada ko\'rish', c.mapsUrl)]])
      : undefined;
    await ctx.reply(
      `📍 <b>Manzil:</b> ${escHtml(c?.address)}`,
      { parse_mode: 'HTML', ...mainMenuKeyboard(), ...(keyboard ?? {}) },
    );
  });

  // ── Bog'lanish ────────────────────────────────────────────────────
  bot.hears('📞 Bog\'lanish', async (ctx) => {
    const c = await services.clinicSettingsService.get(clinicId);
    let text = `📞 <b>Bog'lanish ma'lumotlari:</b>\n\n`;
    text += `📱 Telefon: ${escHtml(c?.phone)}\n`;
    text += `💬 Telegram: ${escHtml(c?.telegram)}\n`;
    if (c?.tgUrl || c?.igUrl) {
      text += `\n🌐 Ijtimoiy tarmoqlar:\n`;
      if (c.tgUrl) text += `<a href="${escHtml(c.tgUrl)}">Telegram</a>\n`;
      if (c.igUrl) text += `<a href="${escHtml(c.igUrl)}">Instagram</a>\n`;
    }
    text += `\n🦷 <b>${escHtml(c?.name)}</b> — sizning tabassumingiz bizning g'ururimiz!`;
    await ctx.reply(text, { parse_mode: 'HTML', ...mainMenuKeyboard() });
  });

  // ── Qabullarim ────────────────────────────────────────────────────
  bot.hears('📋 Qabullarim', async (ctx) => {
    const user = await services.usersService.findByTelegramId(ctx.from.id, clinicId);
    if (!user) { await ctx.reply('Avval /start bosing.'); return; }
    const apts = await services.appointmentsService.findUpcomingByUser(user.id, clinicId);
    if (!apts.length) {
      await ctx.reply('📋 Sizda hozircha rejalashtirilgan qabul yo\'q.', mainMenuKeyboard());
      return;
    }
    const now = new Date();
    const rows = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      const aptTime = new Date(`${a.timeSlot.date}T${a.timeSlot.time}:00+05:00`);
      const icon = aptTime <= now ? '✅' : '📅';
      return [Markup.button.callback(`${icon} ${d}.${mo}.${y} ${fmtTime(a.timeSlot.time)} — ${a.service.name}`, `myapt:${a.id}`)];
    });
    await ctx.reply('📋 *Mening qabullarim:*', { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action(/^myapt:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(aptId);
    if (!apt || apt.user.telegramId !== ctx.from.id) return;
    const [y, mo, d] = apt.timeSlot.date.split('-');
    const now = new Date();
    const aptDateTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptDateTime.getTime() - now.getTime();
    const isPast = msLeft <= 0;
    const canCancel = msLeft > 2 * 60 * 60 * 1000;
    const text = `📋 *Qabul ma'lumotlari:*\n\n🦷 Xizmat: ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n👤 ${apt.clientName}\n📱 ${apt.clientPhone}`;
    const rows: any[][] = [];
    if (isPast) rows.push([Markup.button.callback('✅ Qabul tugagan', 'myapt:done')]);
    else if (canCancel) rows.push([Markup.button.callback('❌ Bekor qilish', `myapt:cancel:${apt.id}`)]);
    else rows.push([Markup.button.callback('⚠️ 2 soat qoldi, bekor qilib bo\'lmaydi', 'myapt:noop')]);
    rows.push([Markup.button.callback('⬅️ Qabullarimga qaytish', 'myapt:list')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action('myapt:list', async (ctx) => {
    await ctx.answerCbQuery();
    const user = await services.usersService.findByTelegramId(ctx.from.id, clinicId);
    if (!user) return;
    const apts = await services.appointmentsService.findUpcomingByUser(user.id, clinicId);
    if (!apts.length) { await ctx.editMessageText('📋 Sizda hozircha rejalashtirilgan qabul yo\'q.'); return; }
    const now = new Date();
    const rows = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      const aptTime = new Date(`${a.timeSlot.date}T${a.timeSlot.time}:00+05:00`);
      const icon = aptTime <= now ? '✅' : '📅';
      return [Markup.button.callback(`${icon} ${d}.${mo}.${y} ${fmtTime(a.timeSlot.time)} — ${a.service.name}`, `myapt:${a.id}`)];
    });
    await ctx.editMessageText('📋 *Mening qabullarim:*', { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action('myapt:noop', async (ctx) => {
    await ctx.answerCbQuery('Qabulga 2 soatdan kam vaqt qoldi!', { show_alert: true });
  });

  bot.action('myapt:done', async (ctx) => {
    await ctx.answerCbQuery('✅ Qabul tugagan. Tashrifingiz uchun rahmat!', { show_alert: true });
  });

  bot.action(/^myapt:cancel:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const aptId = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(aptId);
    if (!apt || apt.user.telegramId !== ctx.from.id) return;
    const now = new Date();
    const aptDateTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    if (aptDateTime.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) {
      await ctx.answerCbQuery('Qabulga 2 soatdan kam vaqt qoldi, bekor qilib bo\'lmaydi!', { show_alert: true });
      return;
    }
    const sess = getUSess(ctx.from.id);
    sess.step = 'cancel_reason';
    sess.cancellingAptId = aptId;
    await ctx.editMessageText(
      '📝 Bekor qilish sababini yozing:\n_(masalan: Boshqa vaqtga ko\'chirmoqchiman)_',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', `myapt:${aptId}`)]]) },
    );
  });

  // ── Qabulga yozilish ──────────────────────────────────────────────
  bot.hears('📅 Qabulga yozilish', async (ctx) => {
    const svcList = await services.servicesService.findAll(clinicId);
    const sess = getUSess(ctx.from.id);
    sess.step = 'choose_service';
    await ctx.reply('🦷 Qaysi xizmatga yozilmoqchisiz?', buildServicesKeyboard(svcList));
  });

  bot.action(/^svc:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const serviceId = parseInt((ctx as any).match[1]);
    const service = await services.servicesService.findById(serviceId, clinicId);
    if (!service) return;
    const sess = getUSess(ctx.from.id);
    sess.serviceId = serviceId;
    sess.step = 'choose_date';
    const now = new Date();
    sess.calYear = now.getFullYear();
    sess.calMonth = now.getMonth();
    const schedule = await getScheduleInfo();
    await ctx.editMessageText(
      `✅ Xizmat: *${service.name}*\n\n📅 *Sanani tanlang:*\n🟢 = bo'sh kun · 🔴 = dam olish`,
      { parse_mode: 'Markdown', ...buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule) },
    );
  });

  bot.action('svc:back', async (ctx) => {
    await ctx.answerCbQuery();
    clearUSess(ctx.from.id);
    await ctx.editMessageText('🏠 Bosh menyuga qaytildi.');
    await ctx.reply('Quyidagi bo\'limlardan birini tanlang:', mainMenuKeyboard());
  });

  bot.action('svc:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    clearUSess(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  });

  bot.action(/^cal:prev:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, y, m] = (ctx as any).match;
    let year = parseInt(y), month = parseInt(m) - 1;
    if (month < 0) { month = 11; year--; }
    const sess = getUSess(ctx.from.id);
    sess.calYear = year; sess.calMonth = month;
    const schedule = await getScheduleInfo();
    await ctx.editMessageReplyMarkup(buildCalendarKeyboard(year, month, schedule).reply_markup);
  });

  bot.action(/^cal:next:(\d+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, y, m] = (ctx as any).match;
    let year = parseInt(y), month = parseInt(m) + 1;
    if (month > 11) { month = 0; year++; }
    const sess = getUSess(ctx.from.id);
    sess.calYear = year; sess.calMonth = month;
    const schedule = await getScheduleInfo();
    await ctx.editMessageReplyMarkup(buildCalendarKeyboard(year, month, schedule).reply_markup);
  });

  bot.action('cal:back', async (ctx) => {
    await ctx.answerCbQuery();
    const svcList = await services.servicesService.findAll(clinicId);
    const sess = getUSess(ctx.from.id);
    sess.step = 'choose_service';
    await ctx.editMessageText('🦷 Qaysi xizmatga yozilmoqchisiz?', buildServicesKeyboard(svcList));
  });

  bot.action('cal:ignore', async (ctx) => { await ctx.answerCbQuery(); });
  bot.action('cal:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    clearUSess(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  });

  bot.action(/^cal:select:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    const date = (ctx as any).match[1];
    const sess = getUSess(ctx.from.id);
    sess.date = date;
    sess.step = 'choose_time';
    const slots = await services.timeSlotsService.getAllSlotsForDate(clinicId, date);
    const freeCount = slots.filter((s) => !s.isBooked).length;
    if (slots.length === 0 || freeCount === 0) {
      const schedule = await getScheduleInfo();
      await ctx.editMessageText('😔 Bu kunda barcha vaqtlar band.\nBoshqa sanani tanlang:', buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule));
      return;
    }
    const uzNow = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const todayStr = `${uzNow.getUTCFullYear()}-${String(uzNow.getUTCMonth() + 1).padStart(2, '0')}-${String(uzNow.getUTCDate()).padStart(2, '0')}`;
    const isToday = date === todayStr;
    const nowMinutes = isToday ? uzNow.getUTCHours() * 60 + uzNow.getUTCMinutes() : -1;
    const availableCount = slots.filter((s) => {
      if (s.isBooked) return false;
      if (!isToday) return true;
      const [h, m] = s.time.split(':').map(Number);
      return h * 60 + m > nowMinutes;
    }).length;
    if (availableCount === 0) {
      const schedule = await getScheduleInfo();
      await ctx.editMessageText('😔 Bu kunda barcha vaqtlar o\'tib ketgan yoki band.\nBoshqa sanani tanlang:', buildCalendarKeyboard(sess.calYear, sess.calMonth, schedule));
      return;
    }
    const [year, month, day] = date.split('-').map(Number);
    await ctx.editMessageText(
      `📅 Sana: *${day}.${month}.${year}*\n\n🟢 Bo'sh  🔴 Band\nVaqtni tanlang:`,
      { parse_mode: 'Markdown', ...buildTimeKeyboard(slots, date) },
    );
  });

  bot.action(/^time:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const slotId = parseInt((ctx as any).match[1]);
    const slot = await services.timeSlotsService.findById(slotId);
    if (!slot || slot.isBooked) {
      await ctx.answerCbQuery('Bu vaqt band qilindi, boshqasini tanlang', { show_alert: true });
      return;
    }
    const sess = getUSess(ctx.from.id);
    sess.slotId = slotId;
    sess.step = 'enter_name';
    await ctx.editMessageText('👤 Ismingizni kiriting:');
    await ctx.reply('Ismingizni yozing:', nameStepKeyboard());
  });

  bot.action('time:booked', async (ctx) => {
    await ctx.answerCbQuery('🔴 Bu vaqt band. Boshqa vaqtni tanlang.', { show_alert: true });
  });

  bot.action('time:back', async (ctx) => {
    await ctx.answerCbQuery();
    const sess = getUSess(ctx.from.id);
    sess.step = 'choose_date';
    const schedule = await getScheduleInfo();
    const year = sess.calYear ?? new Date().getFullYear();
    const month = sess.calMonth ?? new Date().getMonth();
    await ctx.editMessageText(
      `📅 *Sanani tanlang:*\n🟢 = bo\'sh kun · 🔴 = dam olish`,
      { parse_mode: 'Markdown', ...buildCalendarKeyboard(year, month, schedule) },
    );
  });

  bot.action('time:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    clearUSess(ctx.from.id);
    await ctx.editMessageText('❌ Bekor qilindi.');
    await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
  });

  } // end if (!adminOnly)

  // ── /admin buyrug'i ───────────────────────────────────────────────
  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) { await ctx.reply('⛔ Sizda admin huquqi yo\'q.'); return; }
    await ctx.reply('👨‍⚕️ *Admin panel*', { parse_mode: 'Markdown', ...adminMainKb(miniAppUrl) });
  });

  bot.action('adm:back', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    delASess(ctx.from.id);
    await ctx.editMessageText('👨‍⚕️ *Admin panel*', { parse_mode: 'Markdown', ...adminMainKb(miniAppUrl) });
  });

  // ── /paid command ─────────────────────────────────────────────────
  const handlePaid = async (ctx: any) => {
    if (!isAdmin(ctx.from.id)) return;
    const currentClinic = await services.clinicsService.findById(clinicId);
    if (!currentClinic) return;
    if (currentClinic.status === 'suspended') {
      await ctx.reply('⛔ Klinikangiz to\'xtatilgan. Murojaat qiling.');
      return;
    }
    const hasPending = await services.paymentsService.hasPendingByClinic(clinicId);
    if (hasPending) {
      await ctx.reply('⏳ Sizning to\'lovingiz tasdiqlanishi kutilmoqda. Sabr qiling.');
      return;
    }
    const plans = await services.plansService.findAll();
    const cardNum = process.env.PAYMENT_CARD_NUMBER || '—';
    const cardOwner = process.env.PAYMENT_CARD_OWNER || '—';
    setASess(ctx.from.id, { payStep: 'choose_plan' });
    const subInfo = buildSubscriptionInfo(currentClinic);
    const planBtns = plans.map((p) => [
      Markup.button.callback(`${p.name} — ${p.price.toLocaleString()} so'm (${p.durationDays} kun)`, `pay:plan:${p.id}`),
    ]);
    planBtns.push([Markup.button.callback('❌ Bekor qilish', 'pay:cancel')]);
    await ctx.reply(
      `💳 *Obuna to\'lovi*\n\n${subInfo}\n\n💳 Karta raqami: \`${cardNum}\`\n👤 Egasi: *${cardOwner}*\n\nQaysi rejani tanlaysiz?`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(planBtns) },
    );
  };
  bot.command('paid', handlePaid);
  bot.action('pay:start', async (ctx) => { await ctx.answerCbQuery(); await handlePaid(ctx); });

  bot.action(/^pay:plan:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const planId = parseInt((ctx as any).match[1]);
    const plan = await services.plansService.findById(planId);
    if (!plan) return;
    const promo = await services.promosService.findActive();
    let amount = plan.price;
    let promoLine = '';
    if (promo) {
      amount = services.promosService.applyDiscount(amount, promo);
      promoLine = `\n🎁 Promo: *${promo.title}* — chegirma qo'llanildi!\n`;
    }
    const cardNum = process.env.PAYMENT_CARD_NUMBER || '—';
    const cardOwner = process.env.PAYMENT_CARD_OWNER || '—';
    const aSess = getASess(ctx.from.id);
    aSess.payStep = 'send_screenshot';
    aSess.payPlanId = planId;
    aSess.payPlanName = plan.name;
    aSess.payAmount = amount;
    setASess(ctx.from.id, aSess);
    await ctx.editMessageText(
      `💳 *To\'lov ma\'lumotlari:*\n\n📋 Reja: *${plan.name}* (${plan.durationDays} kun)\n💰 Summa: *${amount.toLocaleString()} so\'m*${promoLine}\n\n💳 Karta: \`${cardNum}\`\n👤 Egasi: *${cardOwner}*\n\nPul o\'tkazganingizdan so\'ng *skrinshotni yuboring:*`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Rejani o\'zgartirish', 'pay:back'), Markup.button.callback('❌ Bekor qilish', 'pay:cancel')]]),
      },
    );
  });

  bot.action('pay:back', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const currentClinic = await services.clinicsService.findById(clinicId);
    const plans = await services.plansService.findAll();
    const cardNum = process.env.PAYMENT_CARD_NUMBER || '—';
    const cardOwner = process.env.PAYMENT_CARD_OWNER || '—';
    setASess(ctx.from.id, { payStep: 'choose_plan' });
    const subInfo = buildSubscriptionInfo(currentClinic);
    const planBtns = plans.map((p) => [
      Markup.button.callback(`${p.name} — ${p.price.toLocaleString()} so'm (${p.durationDays} kun)`, `pay:plan:${p.id}`),
    ]);
    planBtns.push([Markup.button.callback('❌ Bekor qilish', 'pay:cancel')]);
    await ctx.editMessageText(
      `💳 *Obuna to\'lovi*\n\n${subInfo}\n\n💳 Karta raqami: \`${cardNum}\`\n👤 Egasi: *${cardOwner}*\n\nQaysi rejani tanlaysiz?`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard(planBtns) },
    );
  });

  bot.action('pay:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    delASess(ctx.from.id);
    await ctx.editMessageText('❌ To\'lov bekor qilindi.');
  });

  // ── Broadcast ─────────────────────────────────────────────────────
  bot.action('adm:broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const userCount = await services.usersService.count(clinicId);
    setASess(ctx.from.id, { broadcastStep: 'enter_text' });
    await ctx.editMessageText(
      `📢 *Foydalanuvchilarga xabar yuborish*\n\n👥 Jami: *${userCount}* ta\n\nXabarni yozing:`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')]]) },
    );
  });

  bot.action('adm:bc:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    delASess(ctx.from.id);
    await ctx.editMessageText('👨‍⚕️ *Admin panel*', { parse_mode: 'Markdown', ...adminMainKb(miniAppUrl) });
  });

  bot.action('adm:bc:confirm', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const sess = getASess(ctx.from.id);
    if (!sess?.broadcastText && !sess?.broadcastPhotoId) return;
    const users = await services.usersService.findAll(clinicId);
    let sent = 0, failed = 0;
    await ctx.editMessageText(`📤 Yuborilmoqda... (0 / ${users.length})`);
    const botInfo = await bot.telegram.getMe();
    const bookingRow = [{ text: '📅 Qabulga yozilish', url: `https://t.me/${botInfo.username}?start=book` }];
    const customRows: any[][] = sess.broadcastCustomButtons?.length ? sess.broadcastCustomButtons : [];
    const finalKb = { reply_markup: { inline_keyboard: [...customRows, bookingRow] } };
    for (const user of users) {
      try {
        if (sess.broadcastPhotoId) {
          await bot.telegram.sendPhoto(user.telegramId, sess.broadcastPhotoId, { caption: sess.broadcastText || undefined, parse_mode: 'Markdown', ...finalKb });
        } else {
          await bot.telegram.sendMessage(user.telegramId, sess.broadcastText!, { parse_mode: 'Markdown', ...finalKb });
        }
        sent++;
      } catch { failed++; }
      if ((sent + failed) % 20 === 0) {
        try { await ctx.editMessageText(`📤 Yuborilmoqda... (${sent + failed} / ${users.length})`); } catch {}
      }
    }
    delASess(ctx.from.id);
    await ctx.editMessageText(
      `✅ *Xabar yuborildi!*\n\n📨 Yuborildi: *${sent}* ta\n❌ Yuborilmadi: *${failed}* ta`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );
  });

  // ── Bugungi / Haftalik ────────────────────────────────────────────
  bot.action('adm:today', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const list = await services.appointmentsService.findTodayAppointments(clinicId);
    if (!list.length) {
      await ctx.editMessageText('📋 Bugun uchun qabul yo\'q.', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) });
      return;
    }
    const now = new Date();
    let text = `📋 *Bugungi qabullar:*\n\n`;
    for (const a of list) text += `🕐 *${a.timeSlot.time}* — ${a.service.name}\n👤 ${a.clientName} | 📱 ${a.clientPhone}\n\n`;
    const cancelBtns = list.map((a) => {
      const aptTime = new Date(`${a.timeSlot.date}T${a.timeSlot.time}:00+05:00`);
      const msLeft = aptTime.getTime() - now.getTime();
      if (msLeft <= 0) return Markup.button.callback(`✅ ${fmtTime(a.timeSlot.time)} yakunlandi`, 'adm:noop');
      if (msLeft <= 30 * 60 * 1000) return Markup.button.callback(`⏳ ${fmtTime(a.timeSlot.time)} (30 daq qoldi)`, 'adm:noop');
      return Markup.button.callback(`❌ ${fmtTime(a.timeSlot.time)} bekor`, `adm:cancel:${a.id}`);
    });
    const btns: any[][] = [];
    for (let i = 0; i < cancelBtns.length; i += 2) btns.push(cancelBtns.slice(i, i + 2));
    btns.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
  });

  const renderWeek = async (ctx: any) => {
    const list = await services.appointmentsService.findWeekAppointments(clinicId);
    if (!list.length) {
      await ctx.editMessageText('📅 Kelgusi hafta uchun qabul yo\'q.', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) });
      return;
    }
    const rows: any[][] = [];
    let prevDate = '';
    for (const a of list) {
      if (a.timeSlot?.date !== prevDate) {
        rows.push([Markup.button.callback(`📆 ${fmtDate(a.timeSlot?.date)}`, 'adm:week:ig')]);
        prevDate = a.timeSlot?.date;
      }
      rows.push([Markup.button.callback(`🕐 ${fmtTime(a.timeSlot.time)}  ${a.service.name} — ${a.clientName}`, `adm:wapt:${a.id}`)]);
    }
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);
    await ctx.editMessageText(`📅 *Haftalik jadval* (${list.length} ta qabul):`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  };

  bot.action('adm:week', async (ctx) => { await ctx.answerCbQuery(); if (!isAdmin(ctx.from.id)) return; await renderWeek(ctx); });
  bot.action('adm:week:ig', async (ctx) => { await ctx.answerCbQuery(); });

  bot.action(/^adm:wapt:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }
    const [y, mo, d] = apt.timeSlot.date.split('-');
    const text = `📋 *Qabul #${apt.id}*\n\n🦷 ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n👤 ${apt.clientName}\n📱 ${apt.clientPhone}`;
    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    let actionBtn: any;
    if (msLeft <= 0) actionBtn = Markup.button.callback('✅ Qabul yakunlangan', 'adm:noop');
    else if (msLeft <= 30 * 60 * 1000) actionBtn = Markup.button.callback('⏳ 30 daqiqadan kam qoldi', 'adm:noop');
    else actionBtn = Markup.button.callback('❌ Bekor qilish', `adm:apt:rej:${apt.id}`);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[actionBtn, Markup.button.callback('⬅️ Jadvalga qaytish', 'adm:week')]]) });
  });

  // ── Statistika ────────────────────────────────────────────────────
  bot.action('adm:stats', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const [stats, userCount] = await Promise.all([
      services.appointmentsService.getStats(clinicId),
      services.usersService.count(clinicId),
    ]);
    await ctx.editMessageText(
      `📊 *Statistika:*\n\n👥 Foydalanuvchilar: *${userCount}*\n\n📋 Jami: *${stats.total}*\n✅ Tasdiqlangan: *${stats.confirmed}*\n🔴 Bekor: *${stats.cancelled}*\n✔️ Yakunlangan: *${stats.completed}*`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );
  });

  bot.action('adm:noop', async (ctx) => { await ctx.answerCbQuery(); });

  // ── Qabul tasdiqlash / rad etish ──────────────────────────────────
  bot.action('adm:pending', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const apts = await services.appointmentsService.findPendingByAdmin(clinicId);
    if (!apts.length) {
      await ctx.editMessageText('⏳ Tasdiq kutayotgan qabul yo\'q.', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) });
      return;
    }
    let text = `⏳ *Tasdiq kutayotganlar* (${apts.length} ta):\n\n`;
    const btns = apts.map((a) => {
      const [y, mo, d] = a.timeSlot.date.split('-');
      text += `#${a.id} — ${d}.${mo}.${y} ${a.timeSlot.time} | ${a.clientName} | ${a.service.name}\n`;
      return [Markup.button.callback(`✅ #${a.id}`, `adm:apt:ok:${a.id}`), Markup.button.callback(`❌ #${a.id}`, `adm:apt:rej:${a.id}`)];
    });
    btns.push([Markup.button.callback('⬅️ Orqaga', 'adm:back')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(btns) });
  });

  bot.action(/^adm:apt:ok:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }
    await services.appointmentsService.confirm(id);
    const [y, mo, d] = apt.timeSlot.date.split('-');
    await ctx.editMessageText(
      `✅ *Qabul #${id} tasdiqlandi!*\n\n🦷 ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${fmtTime(apt.timeSlot.time)}\n👤 ${apt.clientName}`,
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) },
    );
    try {
      await bot.telegram.sendMessage(apt.user.telegramId, `✅ *Qabulingiz tasdiqlandi!*\n\n🦷 ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${apt.timeSlot.time}\n👤 ${apt.clientName}\n\nKlinikamizga kuting! 😊`, { parse_mode: 'Markdown' });
    } catch {}
  });

  bot.action(/^adm:apt:rej:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }
    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    if (msLeft <= 0) { await ctx.answerCbQuery('Qabul allaqachon yakunlangan!', { show_alert: true }); return; }
    if (msLeft <= 30 * 60 * 1000) { await ctx.answerCbQuery('Qabulga 30 daqiqadan kam vaqt qoldi!', { show_alert: true }); return; }
    setASess(ctx.from.id, { step: 'apt:reject', rejectAptId: id });
    await ctx.editMessageText(`❌ *Qabul #${id} rad etilmoqda...*\n\nRad etish sababini yozing:`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🚫 Bekor qilish', 'adm:back')]]) });
  });

  // ── Qabulni bekor qilish (admin) ──────────────────────────────────
  bot.action(/^adm:cancel:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const apt = await services.appointmentsService.findById(id);
    if (!apt) { await ctx.answerCbQuery('Topilmadi', { show_alert: true }); return; }
    const now = new Date();
    const aptTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
    const msLeft = aptTime.getTime() - now.getTime();
    if (msLeft <= 0) { await ctx.answerCbQuery('Qabul allaqachon yakunlangan!', { show_alert: true }); return; }
    if (msLeft <= 30 * 60 * 1000) { await ctx.answerCbQuery('Qabulga 30 daqiqadan kam vaqt qoldi!', { show_alert: true }); return; }
    await services.appointmentsService.cancel(id);
    if (apt.timeSlot) await services.timeSlotsService.freeSlot(apt.timeSlot.id);
    try { await bot.telegram.sendMessage(apt.user.telegramId, `❌ *Qabulingiz bekor qilindi*\n\n🦷 ${apt.service.name}\n📅 ${fmtDate(apt.timeSlot?.date)} soat ${apt.timeSlot?.time}`, { parse_mode: 'Markdown' }); } catch {}
    await ctx.editMessageText(`✅ Qabul #${id} bekor qilindi.`, { ...Markup.inlineKeyboard([[Markup.button.callback('📋 Bugungi qabullar', 'adm:today')]]) });
  });

  // ── Ish vaqti ─────────────────────────────────────────────────────
  bot.action('adm:schedule', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const schedule = await services.workScheduleService.get(clinicId);
    await ctx.editMessageText(buildScheduleSummary(schedule), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📅 Ish kunlarini sozla', 'adm:sch:cal'), Markup.button.callback('🕐 Ish soatlarini sozla', 'adm:sch:hours')],
        [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
      ]),
    });
  });

  const renderAdminCalendar = async (ctx: any, year: number, month: number, isNew: boolean) => {
    const schedule = await services.workScheduleService.get(clinicId);
    const kb = await buildAdminCalendarKeyboard(year, month, schedule);
    const text = `📅 *Ish kunlari — ${UZ_MONTHS[month]} ${year}*\n\n✅ = ish kuni  🔴 = dam olish\n_(sanaga bosib o'zgartiring)_`;
    try { isNew ? await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb }) : await ctx.editMessageText(text, { parse_mode: 'Markdown', ...kb }); } catch {}
  };

  bot.action('adm:sch:cal', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const now = new Date();
    await renderAdminCalendar(ctx, now.getFullYear(), now.getMonth(), true);
  });

  bot.action(/^adm:sch:cal:p:(\d{4}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    await renderAdminCalendar(ctx, parseInt((ctx as any).match[1]), parseInt((ctx as any).match[2]), false);
  });

  bot.action(/^adm:sch:cal:n:(\d{4}):(\d{1,2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    await renderAdminCalendar(ctx, parseInt((ctx as any).match[1]), parseInt((ctx as any).match[2]), false);
  });

  bot.action(/^adm:sch:cal:t:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const dateStr = (ctx as any).match[1];
    await services.workScheduleService.toggleDate(clinicId, dateStr);
    await services.timeSlotsService.regenerateFutureSlots(clinicId);
    const [y, m] = dateStr.split('-').map(Number);
    await renderAdminCalendar(ctx, y, m - 1, false);
  });

  bot.action('adm:sch:cal:ig', async (ctx) => { await ctx.answerCbQuery(); });

  bot.action('adm:sch:hours', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const schedule = await services.workScheduleService.get(clinicId);
    setASess(ctx.from.id, { hours: [...schedule.workHours] });
    await ctx.editMessageText('🕐 *Ish soatlarini tanlang:*\n_(bosing — yoqish/o\'chirish)_', { parse_mode: 'Markdown', ...buildHoursKeyboard([...schedule.workHours]) });
  });

  bot.action(/^adm:sch:hour:(\d{2}:\d{2})$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const hour = (ctx as any).match[1];
    const sess = getASess(ctx.from.id);
    const hours = sess.hours || [];
    sess.hours = hours.includes(hour) ? hours.filter((h) => h !== hour) : [...hours, hour].sort();
    setASess(ctx.from.id, sess);
    await ctx.editMessageReplyMarkup(buildHoursKeyboard(sess.hours).reply_markup);
  });

  bot.action('adm:sch:hours:save', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const sess = getASess(ctx.from.id);
    if (!sess.hours?.length) { await ctx.answerCbQuery('⚠️ Kamida 1 soat tanlang!', { show_alert: true }); return; }
    await services.workScheduleService.saveWorkHours(clinicId, sess.hours);
    await services.timeSlotsService.regenerateFutureSlots(clinicId);
    delASess(ctx.from.id);
    const schedule = await services.workScheduleService.get(clinicId);
    await ctx.editMessageText(`✅ *Ish soatlari saqlandi!*\n\n${buildScheduleSummary(schedule)}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📅 Kunlarni sozla', 'adm:sch:cal'), Markup.button.callback('🕐 Soatlarni sozla', 'adm:sch:hours')],
        [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
      ]),
    });
  });

  // ── Sozlamalar ────────────────────────────────────────────────────
  bot.action('adm:settings', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    await ctx.editMessageText('⚙️ *Sozlamalar*\n\nQaysi bo\'limni boshqarmoqchisiz?', {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🦷 Xizmatlar', 'adm:svc:list'), Markup.button.callback('❓ FAQ', 'adm:faq:list')],
        [Markup.button.callback('🏥 Klinika ma\'lumotlari', 'adm:clinic'), Markup.button.callback('👮 Adminlar', 'adm:admins')],
        [Markup.button.callback('⬅️ Orqaga', 'adm:back')],
      ]),
    });
  });

  // ── Fikrlar ───────────────────────────────────────────────────────
  bot.action('adm:reviews', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const [stats, reviewList] = await Promise.all([
      services.reviewsService.getStats(clinicId),
      services.reviewsService.findAll(clinicId, 15),
    ]);
    if (!stats.total) {
      await ctx.editMessageText('💬 Hali hech qanday fikr yo\'q.', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) });
      return;
    }
    const stars = (n: number) => '⭐'.repeat(n) + '☆'.repeat(5 - n);
    let text = `💬 *Mijozlar fikri*\n\n📊 Jami: *${stats.total}* ta | O'rtacha: *${stats.avg}* ⭐\n\n`;
    for (const r of reviewList) {
      const [y, m, d] = (r.appointmentDate || '').split('-');
      const dateStr = r.appointmentDate ? `${d}.${m}.${y}` : '';
      text += `${stars(r.rating)} *${r.clientName || 'Mijoz'}*`;
      if (dateStr) text += ` | ${dateStr}`;
      if (r.serviceName) text += `\n🦷 ${r.serviceName}`;
      if (r.comment) text += `\n💬 _${r.comment}_`;
      text += '\n\n';
    }
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:back')]]) });
  });

  // ── Xizmatlar CRUD ────────────────────────────────────────────────
  bot.action('adm:svc:list', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    delASess(ctx.from.id);
    const svcs = await services.servicesService.findAllAdmin(clinicId);
    const rows = svcs.map((s) => [Markup.button.callback(`${s.emoji || '🦷'} ${s.name}${s.isActive ? '' : ' ⛔'}`, `adm:svc:${s.id}`)]);
    rows.push([Markup.button.callback('➕ Yangi xizmat qo\'shish', 'adm:svc:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`🦷 *Xizmatlar* (${svcs.length} ta)`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action(/^adm:svc:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await services.servicesService.findById(id, clinicId);
    if (!svc) return;
    await ctx.editMessageText(`🦷 *${svc.emoji || ''} ${svc.name}*\n\nHolati: ${svc.isActive ? '✅ Faol' : '⛔ Nofaol'}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Nomini o\'zgartir', `adm:svc:en:${id}`), Markup.button.callback('😀 Emojini o\'zgartir', `adm:svc:ee:${id}`)],
        [Markup.button.callback(svc.isActive ? '⛔ Nofaol qilish' : '✅ Faol qilish', `adm:svc:tgl:${id}`), Markup.button.callback('🗑 O\'chirish', `adm:svc:del:${id}`)],
        [Markup.button.callback('⬅️ Orqaga', 'adm:svc:list')],
      ]),
    });
  });

  bot.action('adm:svc:add', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    setASess(ctx.from.id, { step: 'svc:add:name' });
    await ctx.editMessageText('🦷 Yangi xizmat nomini kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]) });
  });

  bot.action(/^adm:svc:en:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    setASess(ctx.from.id, { step: 'svc:edit:name', editId: id });
    await ctx.editMessageText('✏️ Yangi nomni kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]) });
  });

  bot.action(/^adm:svc:ee:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    setASess(ctx.from.id, { step: 'svc:edit:emoji', editId: id });
    await ctx.editMessageText('😀 Yangi emojini kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]) });
  });

  bot.action(/^adm:svc:tgl:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await services.servicesService.findById(id, clinicId);
    if (!svc) return;
    await services.servicesService.update(id, { isActive: !svc.isActive });
    const updated = await services.servicesService.findById(id, clinicId);
    await ctx.editMessageText(`🦷 *${updated!.emoji || ''} ${updated!.name}*\n\nHolati: ${updated!.isActive ? '✅ Faol' : '⛔ Nofaol'}`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Nomini o\'zgartir', `adm:svc:en:${id}`), Markup.button.callback('😀 Emojini o\'zgartir', `adm:svc:ee:${id}`)],
        [Markup.button.callback(updated!.isActive ? '⛔ Nofaol qilish' : '✅ Faol qilish', `adm:svc:tgl:${id}`), Markup.button.callback('🗑 O\'chirish', `adm:svc:del:${id}`)],
        [Markup.button.callback('⬅️ Orqaga', 'adm:svc:list')],
      ]),
    });
  });

  bot.action(/^adm:svc:del:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const svc = await services.servicesService.findById(id, clinicId);
    if (!svc) return;
    await ctx.editMessageText(`🗑 *${svc.name}* xizmatini o'chirishni tasdiqlaysizmi?\n\n⚠️ Bu amalni qaytarib bo'lmaydi!`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('✅ Ha, o\'chirish', `adm:svc:dok:${id}`)], [Markup.button.callback('❌ Yo\'q', `adm:svc:${id}`)]]),
    });
  });

  bot.action(/^adm:svc:dok:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    await services.servicesService.remove(id);
    const svcs = await services.servicesService.findAllAdmin(clinicId);
    const rows = svcs.map((s) => [Markup.button.callback(`${s.emoji || '🦷'} ${s.name}${s.isActive ? '' : ' ⛔'}`, `adm:svc:${s.id}`)]);
    rows.push([Markup.button.callback('➕ Yangi xizmat qo\'shish', 'adm:svc:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`✅ O\'chirildi!\n\n🦷 *Xizmatlar* (${svcs.length} ta)`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  // ── FAQ CRUD ──────────────────────────────────────────────────────
  bot.action('adm:faq:list', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    delASess(ctx.from.id);
    const faqs = await services.faqService.findAllAdmin(clinicId);
    const rows = faqs.map((f) => [Markup.button.callback(f.question.length > 40 ? f.question.slice(0, 40) + '…' : f.question, `adm:faq:${f.id}`)]);
    rows.push([Markup.button.callback('➕ Yangi savol qo\'shish', 'adm:faq:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`❓ *Tez-tez savollar* (${faqs.length} ta)`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  bot.action(/^adm:faq:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const faq = await services.faqService.findById(id);
    if (!faq) return;
    const preview = faq.answer.length > 100 ? faq.answer.slice(0, 100) + '…' : faq.answer;
    await ctx.editMessageText(`❓ <b>${esc(faq.question)}</b>\n\n💬 ${esc(preview)}`, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Savolni o\'zgartir', `adm:faq:eq:${id}`), Markup.button.callback('✏️ Javobni o\'zgartir', `adm:faq:ea:${id}`)],
        [Markup.button.callback('🗑 O\'chirish', `adm:faq:del:${id}`), Markup.button.callback('⬅️ Orqaga', 'adm:faq:list')],
      ]),
    });
  });

  bot.action('adm:faq:add', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    setASess(ctx.from.id, { step: 'faq:add:q' });
    await ctx.editMessageText('❓ Yangi savolni kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]) });
  });

  bot.action(/^adm:faq:eq:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    setASess(ctx.from.id, { step: 'faq:edit:q', editId: id });
    await ctx.editMessageText('✏️ Yangi savolni kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]) });
  });

  bot.action(/^adm:faq:ea:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    setASess(ctx.from.id, { step: 'faq:edit:a', editId: id });
    await ctx.editMessageText('✏️ Yangi javobni kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]) });
  });

  bot.action(/^adm:faq:del:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    const faq = await services.faqService.findById(id);
    if (!faq) return;
    await ctx.editMessageText(`🗑 Bu savolni o'chirishni tasdiqlaysizmi?\n\n*${faq.question}*`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([[Markup.button.callback('✅ Ha, o\'chirish', `adm:faq:dok:${id}`)], [Markup.button.callback('❌ Yo\'q', `adm:faq:${id}`)]]),
    });
  });

  bot.action(/^adm:faq:dok:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const id = parseInt((ctx as any).match[1]);
    await services.faqService.remove(id);
    const faqs = await services.faqService.findAllAdmin(clinicId);
    const rows = faqs.map((f) => [Markup.button.callback(f.question.length > 40 ? f.question.slice(0, 40) + '…' : f.question, `adm:faq:${f.id}`)]);
    rows.push([Markup.button.callback('➕ Yangi savol qo\'shish', 'adm:faq:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(`✅ O\'chirildi!\n\n❓ *Tez-tez savollar* (${faqs.length} ta)`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  });

  // ── Klinika ma'lumotlari ──────────────────────────────────────────
  bot.action('adm:clinic', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    delASess(ctx.from.id);
    await showClinicSettings(ctx, false);
  });

  const showClinicSettings = async (ctx: any, isNew: boolean) => {
    const c = await services.clinicSettingsService.get(clinicId);
    const text = `🏥 <b>Klinika ma'lumotlari</b>\n\n📛 Nomi: ${esc(c?.name)}\n📍 Manzil: ${esc(c?.address)}\n📱 Telefon: ${esc(c?.phone)}\n💬 Telegram: ${esc(c?.telegram)}\n🗺 Xarita: ${esc(c?.mapsUrl)}\n\n🌐 <b>Ijtimoiy tarmoqlar:</b>\nTelegram: ${esc(c?.tgUrl)}\nInstagram: ${esc(c?.igUrl)}`;
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback('📛 Nomini o\'zgartir', 'adm:cl:name'), Markup.button.callback('📍 Manzilni o\'zgartir', 'adm:cl:addr')],
      [Markup.button.callback('📱 Telefonni o\'zgartir', 'adm:cl:phone'), Markup.button.callback('💬 Telegramni o\'zgartir', 'adm:cl:tg')],
      [Markup.button.callback('🗺 Xarita linkini o\'zgartir', 'adm:cl:maps')],
      [Markup.button.callback('✈️ Telegram link', 'adm:cl:tgurl'), Markup.button.callback('📷 Instagram link', 'adm:cl:igurl')],
      [Markup.button.callback('⬅️ Orqaga', 'adm:settings')],
    ]);
    if (isNew) await ctx.reply(text, { parse_mode: 'HTML', ...kb });
    else await ctx.editMessageText(text, { parse_mode: 'HTML', ...kb });
  };

  const clinicFieldActions: Record<string, string> = {
    'adm:cl:name': 'clinic:name', 'adm:cl:addr': 'clinic:address',
    'adm:cl:phone': 'clinic:phone', 'adm:cl:tg': 'clinic:telegram',
    'adm:cl:maps': 'clinic:mapsUrl', 'adm:cl:tgurl': 'clinic:tgUrl', 'adm:cl:igurl': 'clinic:igUrl',
  };
  const clinicFieldPrompts: Record<string, string> = {
    'adm:cl:name': '📛 Yangi klinika nomini kiriting:',
    'adm:cl:addr': '📍 Yangi manzilni kiriting:',
    'adm:cl:phone': '📱 Yangi telefon raqamini kiriting:',
    'adm:cl:tg': '💬 Yangi Telegram username kiriting (masalan: @smiledentaluz):',
    'adm:cl:maps': '🗺 Yangi Google Maps linkini kiriting:',
    'adm:cl:tgurl': '✈️ Telegram kanal linkini kiriting:',
    'adm:cl:igurl': '📷 Instagram sahifa linkini kiriting:',
  };

  for (const [action, step] of Object.entries(clinicFieldActions)) {
    bot.action(action, async (ctx) => {
      await ctx.answerCbQuery();
      if (!isAdmin(ctx.from.id)) return;
      setASess(ctx.from.id, { step });
      await ctx.editMessageText(clinicFieldPrompts[action], { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:clinic')]]) });
    });
  }

  // ── Adminlar boshqaruvi ───────────────────────────────────────────
  bot.action('adm:admins', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    delASess(ctx.from.id);
    await showAdmins(ctx);
  });

  const showAdmins = async (ctx: any) => {
    const dbAdmins = await services.usersService.findAdmins(clinicId);
    const primaryIds = clinic.adminIds;
    let text = '👮 *Adminlar ro\'yxati:*\n\n';
    const rows: any[][] = [];
    for (const id of primaryIds) {
      text += `🔒 \`${id}\` — asosiy admin\n`;
    }
    const dbOnly = dbAdmins.filter((u) => !primaryIds.includes(u.telegramId));
    for (const u of dbOnly) {
      const label = u.fullName ? `${u.fullName} (${u.telegramId})` : `${u.telegramId}`;
      text += `👤 \`${u.telegramId}\`${u.fullName ? ' — ' + u.fullName : ''}\n`;
      rows.push([Markup.button.callback(`❌ O'chirish: ${label}`, `adm:adm:del:${u.telegramId}`)]);
    }
    rows.push([Markup.button.callback('➕ Admin qo\'shish', 'adm:adm:add')]);
    rows.push([Markup.button.callback('⬅️ Orqaga', 'adm:settings')]);
    await ctx.editMessageText(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) });
  };

  bot.action('adm:adm:add', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    setASess(ctx.from.id, { step: 'admin:add' });
    await ctx.editMessageText(
      '👮 Yangi admin Telegram ID sini kiriting:\n_(Foydalanuvchi avval botni ishga tushirgan bo\'lishi kerak)_',
      { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:admins')]]) },
    );
  });

  bot.action(/^adm:adm:del:(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(ctx.from.id)) return;
    const telegramId = parseInt((ctx as any).match[1]);
    await services.usersService.setAdmin(telegramId, clinicId, false);
    adminIds.delete(telegramId);
    const newAdminIds = Array.from(adminIds);
    await services.clinicsService.updateAdminIds(clinicId, newAdminIds);
    await showAdmins(ctx);
  });

  // ── Text handler (user + admin input) ────────────────────────────
  bot.on('text', async (ctx, next) => {
    const text = (ctx.message as any).text as string;
    if (text?.startsWith('/')) return next();

    const userId = ctx.from.id;

    // Admin session handling first
    if (isAdmin(userId)) {
      const aSess = adminSessionMap.get(uKey(userId));
      if (aSess?.broadcastStep || aSess?.step) {
        // apt:reject
        if (aSess.step === 'apt:reject' && aSess.rejectAptId) {
          const aptId = aSess.rejectAptId;
          const apt = await services.appointmentsService.findById(aptId);
          delASess(userId);
          if (apt) {
            await services.appointmentsService.cancel(aptId, text);
            if (apt.timeSlot) await services.timeSlotsService.freeSlot(apt.timeSlot.id);
            const [y, mo, d] = apt.timeSlot.date.split('-');
            try { await bot.telegram.sendMessage(apt.user.telegramId, `❌ *Qabulingiz rad etildi.*\n\n🦷 ${apt.service.name}\n📅 ${d}.${mo}.${y} soat ${apt.timeSlot.time}\n\n📝 Sabab: ${text}\n\nQaytadan yozilish uchun /start bosing.`, { parse_mode: 'Markdown' }); } catch {}
            await ctx.reply(`✅ Qabul #${aptId} rad etildi. Mijozga xabar yuborildi.`, { ...Markup.inlineKeyboard([[Markup.button.callback('⏳ Kutayotganlar', 'adm:pending'), Markup.button.callback('⬅️ Menyu', 'adm:back')]]) });
          }
          return;
        }
        // broadcast
        if (aSess.broadcastStep === 'enter_text') {
          const userCount = await services.usersService.count(clinicId);
          const msg = ctx.message as any;
          aSess.broadcastText = text;
          aSess.broadcastPhotoId = undefined;
          aSess.broadcastCustomButtons = msg.reply_markup?.inline_keyboard ?? [];
          aSess.broadcastStep = 'confirm';
          setASess(userId, aSess);
          await ctx.reply(
            `📢 *Xabar ko'rinishi:*\n\n${text}\n\n━━━━━━━━━━━━━\n👥 *${userCount}* ta foydalanuvchiga yuboriladi.\nTasdiqlaysizmi?`,
            { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('✅ Yuborish', 'adm:bc:confirm')], [Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')]]) },
          );
          return;
        }
        // service add/edit
        if (aSess.step === 'svc:add:name') {
          aSess.tempText = text; aSess.step = 'svc:add:emoji'; setASess(userId, aSess);
          await ctx.reply('😀 Emojini kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:svc:list')]]) });
          return;
        }
        if (aSess.step === 'svc:add:emoji') {
          const svc = await services.servicesService.create(clinicId, aSess.tempText!, text.trim());
          delASess(userId);
          await ctx.reply(`✅ *${svc.emoji} ${svc.name}* xizmati qo'shildi!`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]) });
          return;
        }
        if (aSess.step === 'svc:edit:name') {
          await services.servicesService.update(aSess.editId!, { name: text }); delASess(userId);
          const svc = await services.servicesService.findById(aSess.editId!, clinicId);
          await ctx.reply(`✅ Nom yangilandi: *${svc?.name}*`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]) });
          return;
        }
        if (aSess.step === 'svc:edit:emoji') {
          await services.servicesService.update(aSess.editId!, { emoji: text.trim() }); delASess(userId);
          await ctx.reply(`✅ Emoji yangilandi: *${text.trim()}*`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Xizmatlar', 'adm:svc:list')]]) });
          return;
        }
        // faq
        if (aSess.step === 'faq:add:q') {
          aSess.tempText = text; aSess.step = 'faq:add:a'; setASess(userId, aSess);
          await ctx.reply('💬 Javobni kiriting:', { ...Markup.inlineKeyboard([[Markup.button.callback('❌ Bekor qilish', 'adm:faq:list')]]) });
          return;
        }
        if (aSess.step === 'faq:add:a') {
          await services.faqService.create(clinicId, aSess.tempText!, text); delASess(userId);
          await ctx.reply('✅ Savol qo\'shildi!', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]) });
          return;
        }
        if (aSess.step === 'faq:edit:q') {
          await services.faqService.update(aSess.editId!, { question: text }); delASess(userId);
          await ctx.reply('✅ Savol yangilandi!', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]) });
          return;
        }
        if (aSess.step === 'faq:edit:a') {
          await services.faqService.update(aSess.editId!, { answer: text }); delASess(userId);
          await ctx.reply('✅ Javob yangilandi!', { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ FAQ', 'adm:faq:list')]]) });
          return;
        }
        // admin:add
        if (aSess.step === 'admin:add') {
          const telegramId = parseInt(text.trim());
          if (isNaN(telegramId)) { await ctx.reply('❗ Noto\'g\'ri format. Faqat raqam kiriting:'); return; }
          const user = await services.usersService.findByTelegramId(telegramId, clinicId);
          if (!user) {
            await ctx.reply(`⚠️ ID ${telegramId} topilmadi.\nFoydalanuvchi avval botni ishga tushirgan bo'lishi kerak.`, { ...Markup.inlineKeyboard([[Markup.button.callback('⬅️ Orqaga', 'adm:admins')]]) });
            return;
          }
          await services.usersService.setAdmin(telegramId, clinicId, true);
          adminIds.add(telegramId);
          await services.clinicsService.updateAdminIds(clinicId, Array.from(adminIds));
          delASess(userId);
          const name = user.fullName ? ` (${user.fullName})` : '';
          await ctx.reply(`✅ Admin qo'shildi: \`${telegramId}\`${name}`, { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('👮 Adminlar ro\'yxati', 'adm:admins')]]) });
          return;
        }
        // clinic fields
        const clinicFields: Record<string, string> = {
          'clinic:name': 'name', 'clinic:address': 'address', 'clinic:phone': 'phone',
          'clinic:telegram': 'telegram', 'clinic:mapsUrl': 'mapsUrl', 'clinic:tgUrl': 'tgUrl', 'clinic:igUrl': 'igUrl',
        };
        if (aSess.step && clinicFields[aSess.step]) {
          await services.clinicSettingsService.update(clinicId, { [clinicFields[aSess.step]]: text });
          delASess(userId);
          await ctx.reply('✅ Saqlandi!', { ...Markup.inlineKeyboard([[Markup.button.callback('🏥 Klinika ma\'lumotlariga qaytish', 'adm:clinic')]]) });
          return;
        }
      }
    }

    // User session handling (skip for admin-only bots)
    if (adminOnly) return next();
    if (text === '❌ Bekor qilish') { clearUSess(userId); await ctx.reply('❌ Bekor qilindi.', mainMenuKeyboard()); return; }
    if (text === '⬅️ Orqaga') { await handleBack(ctx, getUSess(userId)); return; }

    const sess = getUSess(userId);

    if (sess.step === 'enter_name') {
      if (text.length < 2) { await ctx.reply('❗ Iltimos, to\'liq ism kiriting:'); return; }
      sess.clientName = text; sess.step = 'enter_phone';
      await ctx.reply('📱 Telefon raqamingizni yuboring yoki kiriting (+998XXXXXXXXX):', phoneStepKeyboard());
      return;
    }
    if (sess.step === 'enter_phone') {
      const phone = text.replace(/\s/g, '');
      if (!/^\+?[0-9]{9,13}$/.test(phone)) { await ctx.reply('❗ Telefon raqam noto\'g\'ri. Qayta kiriting (+998XXXXXXXXX):'); return; }
      sess.clientPhone = phone; sess.step = 'confirm';
      await showConfirmation(ctx, sess); return;
    }
    if (sess.step === 'confirm_text') {
      if (text === '✅ Tasdiqlash') await createAppointment(ctx, sess);
      else { clearUSess(userId); await ctx.reply('❌ Bekor qilindi.', mainMenuKeyboard()); }
      return;
    }
    if (sess.step === 'cancel_reason' && sess.cancellingAptId) {
      const aptId = sess.cancellingAptId;
      const apt = await services.appointmentsService.findById(aptId);
      if (apt && apt.user.telegramId === userId) {
        const now = new Date();
        const aptDateTime = new Date(`${apt.timeSlot.date}T${apt.timeSlot.time}:00+05:00`);
        if (aptDateTime.getTime() - now.getTime() <= 2 * 60 * 60 * 1000) {
          clearUSess(userId);
          await ctx.reply('⚠️ Qabulga 2 soatdan kam vaqt qoldi, bekor qilib bo\'lmaydi!', mainMenuKeyboard());
          return;
        }
        await services.appointmentsService.cancel(aptId, text);
        if (apt.timeSlot) await services.timeSlotsService.freeSlot(apt.timeSlot.id);
        clearUSess(userId);
        await notifyAdminsCancelled(aptId, apt.clientName, apt.timeSlot.date, apt.timeSlot.time, apt.service.name, text, false);
        await ctx.reply('✅ Qabulingiz bekor qilindi.', mainMenuKeyboard());
      } else {
        clearUSess(userId);
      }
      return;
    }
    // Review comment
    const rSess = reviewSessionMap.get(uKey(userId));
    if (rSess) {
      await services.reviewsService.create(clinicId, { telegramId: userId, rating: rSess.rating, comment: text, serviceName: rSess.serviceName, clientName: rSess.clientName, appointmentDate: rSess.appointmentDate });
      reviewSessionMap.delete(uKey(userId));
      await ctx.reply('✅ *Fikringiz uchun rahmat!*\n\nBu bizni yanada yaxshilashga yordam beradi. 🙏', { parse_mode: 'Markdown', ...mainMenuKeyboard() });
      return;
    }

    return next();
  });

  // ── Photo handler (payment screenshot + broadcast) ───────────────
  bot.on('photo', async (ctx, next) => {
    if (!isAdmin(ctx.from.id)) return next();
    const aSess = adminSessionMap.get(uKey(ctx.from.id));

    if (aSess?.payStep === 'send_screenshot' && aSess.payPlanId) {
      const msg = ctx.message as any;
      const photos: any[] = msg.photo;
      const fileId = photos[photos.length - 1].file_id;
      const currentClinic = await services.clinicsService.findById(clinicId);
      const plan = await services.plansService.findById(aSess.payPlanId);
      const payment = await services.paymentsService.create({
        clinic: currentClinic,
        plan,
        amount: aSess.payAmount ?? plan.price,
        adminTelegramId: ctx.from.id,
        screenshotFileId: fileId,
      });
      delASess(ctx.from.id);
      await ctx.reply(
        `✅ *To\'lov ma\'lumotlari qabul qilindi!*\n\n📋 Reja: *${aSess.payPlanName}*\n💰 Summa: *${(aSess.payAmount ?? plan.price).toLocaleString()} so\'m*\n\n⏳ Super admin tasdiqlagandan so\'ng obunangiz faollashadi.\nOdatda 1-24 soat ichida tasdiqlanadi.`,
        { parse_mode: 'Markdown' },
      );
      const capText =
        `💳 *Yangi to\'lov #${payment.id}*\n\n` +
        `🏥 Klinika: ${currentClinic?.name || ''} (#${clinicId})\n` +
        `📋 Reja: ${plan?.name || ''} (${plan?.durationDays || ''} kun)\n` +
        `💰 Summa: ${(aSess.payAmount ?? plan?.price ?? 0).toLocaleString()} so\'m\n` +
        `👤 Admin: ${ctx.from.id}`;
      for (const saId of superAdminIds) {
        try { await bot.telegram.sendPhoto(saId, fileId, { caption: capText, parse_mode: 'Markdown' }); } catch {}
      }
      return;
    }

    if (aSess?.broadcastStep !== 'enter_text') return next();
    const msg = ctx.message as any;
    const photos: any[] = msg.photo;
    const fileId = photos[photos.length - 1].file_id;
    const caption: string = msg.caption || '';
    const userCount = await services.usersService.count(clinicId);
    aSess.broadcastPhotoId = fileId;
    aSess.broadcastText = caption;
    aSess.broadcastCustomButtons = msg.reply_markup?.inline_keyboard ?? [];
    aSess.broadcastStep = 'confirm';
    setASess(ctx.from.id, aSess);
    const confirmKb = Markup.inlineKeyboard([[Markup.button.callback('✅ Yuborish', 'adm:bc:confirm')], [Markup.button.callback('❌ Bekor qilish', 'adm:bc:cancel')]]);
    await ctx.replyWithPhoto(fileId, { caption: caption || undefined });
    await ctx.reply(`📷 Rasm *${userCount}* ta foydalanuvchiga yuboriladi.\nTasdiqlaysizmi?`, { parse_mode: 'Markdown', ...confirmKb });
  });

  // ── Contact handler ───────────────────────────────────────────────
  bot.on('contact', async (ctx) => {
    const contact = (ctx.message as any).contact;
    const sess = getUSess(ctx.from.id);
    if (sess.step === 'enter_phone') {
      sess.clientPhone = contact.phone_number;
      sess.step = 'confirm';
      await showConfirmation(ctx, sess);
    }
  });

  // ── Internal helpers ──────────────────────────────────────────────
  const showConfirmation = async (ctx: any, sess: UserSession) => {
    const service = await services.servicesService.findById(sess.serviceId!, clinicId);
    const slot = await services.timeSlotsService.findById(sess.slotId!);
    const [y, m, d] = sess.date!.split('-');
    const text = `📋 *Qabul ma'lumotlari:*\n\n🦷 Xizmat: *${service!.name}*\n📅 Sana: *${d}.${m}.${y}*\n🕐 Vaqt: *${fmtTime(slot!.time)}*\n👤 Ism: *${sess.clientName}*\n📱 Telefon: *${sess.clientPhone}*\n\nTasdiqlaysizmi?`;
    sess.step = 'confirm_text';
    await ctx.reply(text, { parse_mode: 'Markdown', ...confirmKeyboard() });
  };

  const handleBack = async (ctx: any, sess: UserSession) => {
    if (sess.step === 'confirm_text') {
      sess.step = 'enter_phone';
      await ctx.reply('📱 Telefon raqamingizni yuboring yoki kiriting (+998XXXXXXXXX):', phoneStepKeyboard());
    } else if (sess.step === 'enter_phone') {
      sess.step = 'enter_name'; sess.clientPhone = undefined;
      await ctx.reply('👤 Ismingizni kiriting:', nameStepKeyboard());
    } else if (sess.step === 'enter_name') {
      if (!sess.date || !sess.slotId) { clearUSess(ctx.from.id); await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard()); return; }
      sess.step = 'choose_time'; sess.clientName = undefined;
      const slots = await services.timeSlotsService.getAllSlotsForDate(clinicId, sess.date);
      const [y, m, d] = sess.date.split('-').map(Number);
      await ctx.reply(`📅 Sana: *${d}.${m}.${y}*\n\n🟢 Bo'sh  🔴 Band\nVaqtni tanlang:`, { parse_mode: 'Markdown', ...buildTimeKeyboard(slots, sess.date) });
    } else {
      clearUSess(ctx.from.id);
      await ctx.reply('🏠 Bosh menyu:', mainMenuKeyboard());
    }
  };

  const createAppointment = async (ctx: any, sess: UserSession) => {
    const user = await services.usersService.findByTelegramId(ctx.from.id, clinicId);
    const slot = await services.timeSlotsService.findById(sess.slotId!);
    if (!slot || slot.isBooked) {
      await ctx.reply('😔 Afsuski, bu vaqt band qilingan. Qaytadan yozilib ko\'ring.', mainMenuKeyboard());
      clearUSess(ctx.from.id); return;
    }
    await services.timeSlotsService.bookSlot(sess.slotId!);
    const appointment = await services.appointmentsService.create({
      user,
      service: { id: sess.serviceId } as any,
      timeSlot: { id: sess.slotId } as any,
      clinic: { id: clinicId } as any,
      clientName: sess.clientName,
      clientPhone: sess.clientPhone,
      status: AppointmentStatus.CONFIRMED,
    });
    await services.usersService.updateProfile(ctx.from.id, clinicId, { fullName: sess.clientName, phone: sess.clientPhone });
    const service = await services.servicesService.findById(sess.serviceId!, clinicId);
    const [y, m, d] = sess.date!.split('-');
    await ctx.reply(
      `✅ *Qabul muvaffaqiyatli yozildi!*\n\n🦷 Xizmat: ${service!.name}\n📅 ${d}.${m}.${y} soat ${fmtTime(slot.time)}\n👤 ${sess.clientName}\n\nSog'lom tish — baxtli kun! 😊\nQabuldan 2 soat oldin xabar beramiz.`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard() },
    );
    await notifyAdmins(appointment.id, sess, slot.time);
    clearUSess(ctx.from.id);
  };

  const notifyAdmins = async (appointmentId: number, sess: UserSession, time: string) => {
    const service = await services.servicesService.findById(sess.serviceId!, clinicId);
    const [y, m, d] = sess.date!.split('-');
    const text = `🔔 *Yangi qabul #${appointmentId}*\n\n🦷 Xizmat: ${service!.name}\n📅 ${d}.${m}.${y} soat ${fmtTime(time)}\n👤 ${sess.clientName}\n📱 ${sess.clientPhone}`;
    for (const adminId of Array.from(adminIds)) {
      try { await bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' }); } catch {}
    }
  };

  const notifyAdminsCancelled = async (aptId: number, clientName: string, date: string, time: string, serviceName: string, reason: string, byAdmin: boolean) => {
    const [y, mo, d] = date.split('-');
    const who = byAdmin ? 'Admin' : 'Mijoz';
    const text = `❌ *Qabul #${aptId} bekor qilindi* (${who})\n\n🦷 ${serviceName}\n📅 ${d}.${mo}.${y} soat ${fmtTime(time)}\n👤 ${clientName}\n📝 Sabab: ${reason}`;
    for (const adminId of Array.from(adminIds)) {
      try { await bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' }); } catch {}
    }
  };
}

// ── Keyboard builders ─────────────────────────────────────────────

function adminMainKb(miniAppUrl?: string) {
  const rows: any[] = [];
  if (miniAppUrl) rows.push([Markup.button.webApp('🌐 Mini App ochish', miniAppUrl)]);
  rows.push(
    [Markup.button.callback('📋 Bugungi qabullar', 'adm:today'), Markup.button.callback('📅 Haftalik jadval', 'adm:week')],
    [Markup.button.callback('📊 Statistika', 'adm:stats'), Markup.button.callback('💬 Mijozlar fikri', 'adm:reviews')],
    [Markup.button.callback('⏰ Ish vaqtini sozla', 'adm:schedule'), Markup.button.callback('⚙️ Sozlamalar', 'adm:settings')],
    [Markup.button.callback('📢 Foydalanuvchilarga xabar yuborish', 'adm:broadcast')],
  );
  return Markup.inlineKeyboard(rows);
}

async function buildAdminCalendarKeyboard(year: number, month: number, schedule: any) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;
  const rows: any[][] = [];
  let pYear = year, pMonth = month - 1;
  if (pMonth < 0) { pMonth = 11; pYear--; }
  let nYear = year, nMonth = month + 1;
  if (nMonth > 11) { nMonth = 0; nYear++; }
  rows.push([
    Markup.button.callback('◀️', `adm:sch:cal:p:${pYear}:${pMonth}`),
    Markup.button.callback(`${UZ_MONTHS[month]} ${year}`, 'adm:sch:cal:ig'),
    Markup.button.callback('▶️', `adm:sch:cal:n:${nYear}:${nMonth}`),
  ]);
  rows.push(UZ_WEEKDAYS.map((d) => Markup.button.callback(d, 'adm:sch:cal:ig')));
  const workDays: number[] = (schedule.workDays || []).map(Number);
  const blockedDates: string[] = schedule.blockedDates || [];
  const extraWorkDates: string[] = schedule.extraWorkDates || [];
  const dateMap: Record<number, boolean> = {};
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
  for (let i = 0; i < startDow; i++) dayRow.push(Markup.button.callback(' ', 'adm:sch:cal:ig'));
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dt = new Date(year, month, d);
    const isPast = dt < today;
    const isWorking = dateMap[d];
    const label = isPast ? String(d) : (isWorking ? `✅${d}` : `🔴${d}`);
    const cbData = isPast ? 'adm:sch:cal:ig' : `adm:sch:cal:t:${dateStr}`;
    dayRow.push(Markup.button.callback(label, cbData));
    if (dayRow.length === 7) { rows.push(dayRow); dayRow = []; }
  }
  while (dayRow.length > 0 && dayRow.length < 7) dayRow.push(Markup.button.callback(' ', 'adm:sch:cal:ig'));
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
    row.push(Markup.button.callback(activeHours.includes(h) ? label : inactive, `adm:sch:hour:${h}`));
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
    { num: 4, label: 'Pa' }, { num: 5, label: 'Ju' }, { num: 6, label: 'Sh' }, { num: 7, label: 'Ya' },
  ];
  const dayLabels = DAYS.filter((d) => schedule.workDays?.includes(d.num)).map((d) => d.label);
  const blocked = schedule.blockedDates?.length || 0;
  const extra = schedule.extraWorkDates?.length || 0;
  return `⏰ *Hozirgi ish vaqti:*\n\n📅 Asosiy kunlar: *${dayLabels.join(', ')}*\n🕐 Soatlar: *${(schedule.workHours || []).join(' | ')}*\n\n🔴 Maxsus dam olish: *${blocked} kun*\n✅ Maxsus ish kuni: *${extra} kun*`;
}

function buildFaqListKeyboard(faqs: { id: number; question: string }[]) {
  return Markup.inlineKeyboard(faqs.map((f) => [Markup.button.callback(f.question, `faq:show:${f.id}`)]));
}

function escHtml(s: string | null | undefined): string {
  return (s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function esc(s: string | null | undefined): string {
  return (s || '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escMd(s: string | null | undefined): string {
  return (s || '').replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

function buildSocialLine(clinic: { tgUrl?: string; igUrl?: string }): string {
  const parts: string[] = [];
  if (clinic?.tgUrl) parts.push(`[Telegram](${clinic.tgUrl})`);
  if (clinic?.igUrl) parts.push(`[Instagram](${clinic.igUrl})`);
  return parts.join('  ·  ');
}

function fmtDate(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function buildSubscriptionInfo(clinic: Clinic | null): string {
  if (!clinic) return '';
  const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
  const daysLeft = endsAt ? Math.ceil((endsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const statusLabels: Record<string, string> = {
    trial: '🆓 Sinov davri', active: '✅ Faol', grace: '⚠️ Grace davri', expired: '❌ Tugagan', suspended: '⛔ To\'xtatilgan',
  };
  let text = `📊 Holat: *${statusLabels[clinic.status] || clinic.status}*`;
  if (daysLeft !== null) {
    text += daysLeft > 0 ? `\n📅 Qoldi: *${daysLeft} kun*` : '\n📅 Muddati tugagan!';
  } else {
    text += '\n📅 Muddati: *Cheksiz*';
  }
  return text;
}
