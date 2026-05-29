import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Markup } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { SuperAdminBotService } from '../super-admin/super-admin-bot.service';
import { PromosService } from '../promos/promos.service';
import { PlansService } from '../plans/plans.service';
import { VisitPaymentsService } from '../visit-payments/visit-payments.service';
import { ClinicStatus } from '../database/entities/clinic.entity';
import { fmtTime } from '../bot/keyboards/calendar.keyboard';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly clinicBotsService: ClinicBotsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly clinicsService: ClinicsService,
    private readonly superAdminBotService: SuperAdminBotService,
    private readonly promosService: PromosService,
    private readonly plansService: PlansService,
    private readonly visitPaymentsService: VisitPaymentsService,
  ) {}

  @Cron('*/10 * * * *')
  keepAlive() {
    this.clinicBotsService.keepAlive();
  }

  @Cron('0 4 * * *')
  async sendDayBeforeReminders() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      const appointments = await this.appointmentsService.getPendingReminders1Day(clinic.id);
      for (const apt of appointments) {
        try {
          const [y, m, d] = apt.timeSlot.date.split('-');
          await this.clinicBotsService.sendMessage(
            clinic.id,
            apt.user.telegramId,
            `⏰ *Eslatma!*\n\nErtaga — ${d}.${m}.${y} soat *${apt.timeSlot.time}* — sizning qabulingiz bor.\n\n🦷 Xizmat: ${apt.service.name}\n\nKlinikamizga keling! 😊`,
            { parse_mode: 'Markdown' },
          );
          await this.appointmentsService.markReminder1DaySent(apt.id);
        } catch (err) {
          this.logger.error(`Eslatma yuborishda xato: ${err.message}`);
        }
      }
    }
  }

  @Cron('*/30 * * * *')
  async send2HourReminders() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      const appointments = await this.appointmentsService.getPendingReminders2Hours(clinic.id);
      for (const apt of appointments) {
        try {
          await this.clinicBotsService.sendMessage(
            clinic.id,
            apt.user.telegramId,
            `🔔 2 soatdan keyin qabulingiz!\n\n⏰ *${apt.timeSlot.time}* — ${apt.service.name}\n\nKechikib qolmang 😊`,
            { parse_mode: 'Markdown' },
          );
          await this.appointmentsService.markReminder2HourSent(apt.id);
        } catch (err) {
          this.logger.error(`2 soatlik eslatmada xato: ${err.message}`);
        }
      }
    }
  }

  @Cron('*/5 * * * *')
  async send10MinReminders() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      const appointments = await this.appointmentsService.getPendingReminders10Min(clinic.id);
      for (const apt of appointments) {
        try {
          await this.clinicBotsService.sendMessage(
            clinic.id,
            apt.user.telegramId,
            `⏰ *10 daqiqadan keyin qabulingiz!*\n\n🦷 Xizmat: ${apt.service.name}\n⏰ Soat: *${fmtTime(apt.timeSlot.time)}*\n\nKechikib qolmang! 🏃`,
            { parse_mode: 'Markdown' },
          );
          await this.appointmentsService.markReminder10MinSent(apt.id);
        } catch (err) {
          this.logger.error(`10 daqiqalik eslatmada xato: ${err.message}`);
        }
      }
    }
  }

  // ── Subscription expiry (daily 08:00 Tashkent = 03:00 UTC) ──────
  @Cron('0 3 * * *')
  async processSubscriptionExpiry() {
    const clinics = await this.clinicsService.findAll();
    const now = new Date();
    const plans = await this.plansService.findAll();
    const murojaatRow = [{ text: '📞 Adminga murojaat', url: 'https://t.me/doniyorjon_k' }];
    const payBtn = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💳 To\'lash', callback_data: 'pay:start' }],
          [murojaatRow[0]],
        ],
      },
    };
    const expiredKb = {
      reply_markup: {
        inline_keyboard: [
          ...plans.map(p => [{ text: `${p.name} — ${p.price.toLocaleString()} so'm (${p.durationDays} kun)`, callback_data: `pay:plan:${p.id}` }]),
          [murojaatRow[0]],
        ],
      },
    };

    for (const clinic of clinics) {
      if (clinic.status === ClinicStatus.SUSPENDED) continue;

      const endsAt = clinic.subscriptionEndsAt ?? clinic.trialEndsAt;
      if (!endsAt) continue; // unlimited — skip

      const msLeft = endsAt.getTime() - now.getTime();
      const daysLeft = Math.ceil(msLeft / 86400000);

      if (clinic.status === ClinicStatus.TRIAL || clinic.status === ClinicStatus.ACTIVE) {
        if (daysLeft <= 7 && daysLeft > 3 && !clinic.notified7Days) {
          await this.notifyClinicAdmins(
            clinic,
            `⚠️ *Obuna eslatmasi*\n\nKlinikangiz obunasi *${daysLeft} kunda* tugaydi.\n\nObunani uzaytiring:`,
            payBtn,
          );
          await this.clinicsService.update(clinic.id, { notified7Days: true });
        }
        if (daysLeft <= 3 && daysLeft > 1 && !clinic.notified3Days) {
          await this.notifyClinicAdmins(
            clinic,
            `🔴 *Obuna tugayapti!*\n\nKlinikangiz obunasi *${daysLeft} kunda* tugaydi.\n\nHoziroq uzaytiring:`,
            payBtn,
          );
          await this.clinicsService.update(clinic.id, { notified3Days: true });
        }
        if (daysLeft <= 1 && daysLeft > 0 && !clinic.notified1Day) {
          await this.notifyClinicAdmins(
            clinic,
            `🚨 *Ertaga obuna tugaydi!*\n\nKlinikangiz ertaga to'xtatiladi.\n\nZudlik bilan to'lang:`,
            payBtn,
          );
          await this.clinicsService.update(clinic.id, { notified1Day: true });
        }
        if (daysLeft <= 0) {
          await this.clinicBotsService.sendToAdminsPreferAdminBot(
            clinic,
            `🔴 *Botingiz to'xtatildi!*\n\nObuna muddati tugadi. Botingizni qayta faollashtirish uchun quyidagi tariflardan birini tanlang:`,
            { parse_mode: 'Markdown', ...expiredKb },
          );
          await this.clinicsService.update(clinic.id, { status: ClinicStatus.EXPIRED });
          this.logger.log(`Clinic ${clinic.id} EXPIRED — obuna tugadi, bot to'lov kutmoqda`);
          await this.superAdminBotService.notify(
            `🚨 *Klinika tugadi!*\n\n🏥 ${clinic.name} (ID: ${clinic.id})\n\nObuna to'lanmadi — bot to'xtatildi.`,
            { parse_mode: 'Markdown' },
          );
        }
      }
    }
  }

  // ── Promo notifications (every hour) ────────────────────────────
  @Cron('0 * * * *')
  async sendPromoNotifications() {
    const promos = await this.promosService.findUnnotified();
    if (!promos.length) return;

    const clinics = await this.clinicsService.findActive();
    for (const promo of promos) {
      const discountLine = promo.discountPercent
        ? `🎁 Chegirma: *${promo.discountPercent}%*`
        : `🎁 Chegirma: *${promo.discountAmount?.toLocaleString()} so'm*`;
      const [fy, fm, fd] = promo.validFrom.split('-');
      const [ty, tm, td] = promo.validTo.split('-');
      const text =
        `🎉 *Yangi promo!*\n\n` +
        `📌 ${promo.title}\n` +
        `${discountLine}\n` +
        `📅 Amal qilish muddati: ${fd}.${fm}.${fy} — ${td}.${tm}.${ty}\n\n` +
        `Obuna to'lashda chegirma avtomatik qo'llaniladi! /paid`;

      for (const clinic of clinics) {
        await this.notifyClinicAdmins(clinic, text);
      }
      await this.promosService.markNotified(promo.id);
      this.logger.log(`Promo #${promo.id} "${promo.title}" haqida xabar yuborildi`);
    }
  }

  // ── Attendance check (every 5 min) ──────────────────────────────
  @Cron('*/5 * * * *')
  async sendAttendanceChecks() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      const appointments = await this.appointmentsService.getPendingAttendanceChecks(clinic.id);
      for (const apt of appointments) {
        try {
          const [y, m, d] = apt.timeSlot.date.split('-');
          const text = `👤 *${apt.clientName}* — ${apt.service?.name || '?'}\n📅 ${d}.${m}.${y} soat ${apt.timeSlot.time}\n\nBemor keldimi?`;
          await this.notifyClinicAdmins(clinic, text, {
            reply_markup: {
              inline_keyboard: [[
                { text: '✅ Keldi', callback_data: `adm:attend:${apt.id}:showed` },
                { text: '❌ Kelmadi', callback_data: `adm:attend:${apt.id}:noshow` },
              ]],
            },
          });
          await this.appointmentsService.markAttendanceCheckSent(apt.id);
        } catch (err) {
          this.logger.error(`Attendance check yuborishda xato: ${err.message}`);
        }
      }
    }
  }

  // ── Daily report (21:00 Tashkent = 16:00 UTC) ───────────────────
  @Cron('0 16 * * *')
  async sendDailyReports() {
    const clinics = await this.clinicsService.findActive();
    const uzNow = new Date(Date.now() + 5 * 3600000);
    const todayStr = uzNow.toISOString().split('T')[0];
    const [ty, tm, td] = todayStr.split('-');
    const dateLabel = `${td}.${tm}.${ty}`;

    for (const clinic of clinics) {
      try {
        const todayApts = await this.appointmentsService.findTodayAppointments(clinic.id);
        const noShowCount = todayApts.filter(a => a.attendanceStatus === 'no_show').length;
        const showedCount = todayApts.filter(a => a.attendanceStatus === 'showed').length;
        const dailyStats = await this.visitPaymentsService.getDailyStats(clinic.id, todayStr);

        const text =
          `📊 *${dateLabel} — Kunlik hisobot*\n\n` +
          `📋 Jami qabullar: *${todayApts.length}* ta\n` +
          `✅ Keldi: *${showedCount}* ta\n` +
          `❌ Kelmadi: *${noShowCount}* ta\n\n` +
          `💰 To'landi: *${dailyStats.paid}* ta — ${dailyStats.paidAmount.toLocaleString()} so'm\n` +
          `💳 Qisman: *${dailyStats.partial}* ta — ${dailyStats.partialAmount.toLocaleString()} so'm\n` +
          `📭 To'lanmadi: *${dailyStats.unpaid}* ta`;

        await this.notifyClinicAdmins(clinic, text);
      } catch (err) {
        this.logger.error(`Daily report yuborishda xato: ${err.message}`);
      }
    }
  }

  private async notifyClinicAdmins(clinic: { id: number; adminIds: number[] }, text: string, extra?: Record<string, any>) {
    for (const adminId of clinic.adminIds) {
      try {
        await this.clinicBotsService.sendMessage(clinic.id, adminId, text, { parse_mode: 'Markdown', ...extra });
      } catch (err) {
        this.logger.error(`notifyClinicAdmins: clinic ${clinic.id} admin ${adminId} ga xabar yuborishda xato: ${err.message}`);
      }
    }
  }

  @Cron('*/30 * * * *')
  async sendReviewRequests() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      const appointments = await this.appointmentsService.getPendingReviewRequests(clinic.id);
      for (const apt of appointments) {
        try {
          const [y, m, d] = apt.timeSlot.date.split('-');
          await this.clinicBotsService.sendMessage(
            clinic.id,
            apt.user.telegramId,
            `⭐ *Qabulingiz haqida fikr bildiring!*\n\n🦷 Xizmat: ${apt.service.name}\n📅 ${d}.${m}.${y} soat ${fmtTime(apt.timeSlot.time)}\n\nXizmat sifatini baholang:`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([[
                Markup.button.callback('1 ⭐', `review:r:${apt.id}:1`),
                Markup.button.callback('2 ⭐', `review:r:${apt.id}:2`),
                Markup.button.callback('3 ⭐', `review:r:${apt.id}:3`),
                Markup.button.callback('4 ⭐', `review:r:${apt.id}:4`),
                Markup.button.callback('5 ⭐', `review:r:${apt.id}:5`),
              ]]),
            },
          );
          await this.appointmentsService.markReviewRequestSent(apt.id);
        } catch (err) {
          this.logger.error(`Baholash so'rovida xato: ${err.message}`);
        }
      }
    }
  }
}
