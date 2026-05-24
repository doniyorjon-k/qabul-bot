import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Markup } from 'telegraf';
import { AppointmentsService } from '../appointments/appointments.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
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
