import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectBot } from 'nestjs-telegraf';
import { Markup, Telegraf } from 'telegraf';
import { ConfigService } from '@nestjs/config';
import { AppointmentsService } from '../appointments/appointments.service';
import { fmtTime } from '../bot/keyboards/calendar.keyboard';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    private readonly appointmentsService: AppointmentsService,
    private readonly configService: ConfigService,
  ) {}

  // Har 10 daqiqada o'ziga ping — Render free tier uyquga ketmasin
  @Cron('*/10 * * * *')
  keepAlive() {
    const appUrl = this.configService.get<string>('app.url');
    if (!appUrl) return;
    const url = `${appUrl}/health`;
    const client = url.startsWith('https') ? https : http;
    client.get(url, () => {}).on('error', () => {});
  }

  // Har kuni soat 09:00 da — ertangi qabullar uchun eslatma
  @Cron('0 9 * * *')
  async sendDayBeforeReminders() {
    this.logger.log('1 kun oldingi eslatmalar yuborilmoqda...');
    const appointments = await this.appointmentsService.getPendingReminders1Day();

    for (const apt of appointments) {
      try {
        const [y, m, d] = apt.timeSlot.date.split('-');
        await this.bot.telegram.sendMessage(
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

  // Har 30 daqiqada — 2 soat qolgan qabullar uchun eslatma
  @Cron('*/30 * * * *')
  async send2HourReminders() {
    const mapsUrl = this.configService.get<string>('clinic.mapsUrl');
    const appointments = await this.appointmentsService.getPendingReminders2Hours();

    for (const apt of appointments) {
      try {
        const keyboard = mapsUrl
          ? Markup.inlineKeyboard([[Markup.button.url('📍 Klinika xaritasi', mapsUrl)]])
          : undefined;

        await this.bot.telegram.sendMessage(
          apt.user.telegramId,
          `🔔 2 soatdan keyin qabulingiz!\n\n⏰ *${apt.timeSlot.time}* — ${apt.service.name}\n\nKechikib qolmang 😊`,
          { parse_mode: 'Markdown', ...(keyboard ?? {}) },
        );
        await this.appointmentsService.markReminder2HourSent(apt.id);
      } catch (err) {
        this.logger.error(`2 soatlik eslatmada xato: ${err.message}`);
      }
    }
  }

  // Har 5 daqiqada — qabuldan 30 daqiqa ichida yozilganlar uchun 10 daqiqalik eslatma
  @Cron('*/5 * * * *')
  async send10MinReminders() {
    const appointments = await this.appointmentsService.getPendingReminders10Min();

    for (const apt of appointments) {
      try {
        await this.bot.telegram.sendMessage(
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

  // Har 30 daqiqada — qabul tugagandan 2 soat o'tgach baholash so'rovi
  @Cron('*/30 * * * *')
  async sendReviewRequests() {
    const appointments = await this.appointmentsService.getPendingReviewRequests();

    for (const apt of appointments) {
      try {
        const [y, m, d] = apt.timeSlot.date.split('-');
        await this.bot.telegram.sendMessage(
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
