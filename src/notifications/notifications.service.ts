import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Markup } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { ClinicStatus } from '../database/entities/clinic.entity';
import { fmtTime } from '../bot/keyboards/calendar.keyboard';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly clinicBotsService: ClinicBotsService,
    private readonly appointmentsService: AppointmentsService,
    private readonly clinicsService: ClinicsService,
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
            `⚠️ *Obuna eslatmasi*\n\nKlinikangiz obunasi *${daysLeft} kunda* tugaydi.\n\nUzaytirish uchun /paid buyrug'ini yuboring.`,
          );
          await this.clinicsService.update(clinic.id, { notified7Days: true });
        }
        if (daysLeft <= 3 && daysLeft > 1 && !clinic.notified3Days) {
          await this.notifyClinicAdmins(
            clinic,
            `🔴 *Obuna tugayapti!*\n\nKlinikangiz obunasi *${daysLeft} kunda* tugaydi.\n\nHoziroq uzaytiring: /paid`,
          );
          await this.clinicsService.update(clinic.id, { notified3Days: true });
        }
        if (daysLeft <= 1 && daysLeft > 0 && !clinic.notified1Day) {
          await this.notifyClinicAdmins(
            clinic,
            `🚨 *Ertaga obuna tugaydi!*\n\nKlinikangiz ertaga to'xtatiladi.\n\nZudlik bilan to'lang: /paid`,
          );
          await this.clinicsService.update(clinic.id, { notified1Day: true });
        }
        if (daysLeft <= 0) {
          await this.clinicsService.update(clinic.id, { status: ClinicStatus.GRACE });
          await this.notifyClinicAdmins(
            clinic,
            `❌ *Obuna muddati tugadi!*\n\nKlinikangiz grace davrida — 3 kun ichida to'lamasangiz bot to'xtatiladi.\n\nTo'lash: /paid`,
          );
          this.logger.log(`Clinic ${clinic.id} moved to GRACE`);
        }
      }

      if (clinic.status === ClinicStatus.GRACE) {
        const graceDays = Math.ceil((now.getTime() - endsAt.getTime()) / 86400000);
        if (graceDays >= 3) {
          await this.clinicsService.update(clinic.id, { status: ClinicStatus.EXPIRED });
          await this.clinicBotsService.stopBot(clinic.id);
          this.logger.log(`Clinic ${clinic.id} EXPIRED and bot stopped`);
        }
      }
    }
  }

  private async notifyClinicAdmins(clinic: { id: number; adminIds: number[] }, text: string) {
    for (const adminId of clinic.adminIds) {
      try {
        await this.clinicBotsService.sendMessage(clinic.id, adminId, text, { parse_mode: 'Markdown' });
      } catch {}
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
