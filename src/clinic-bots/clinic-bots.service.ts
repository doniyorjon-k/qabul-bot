import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { ClinicsService } from '../clinics/clinics.service';
import { UsersService } from '../users/users.service';
import { ServicesService } from '../services/services.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { TimeSlotsService } from '../time-slots/time-slots.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { FaqService } from '../faq/faq.service';
import { ClinicSettingsService } from '../clinic-settings/clinic-settings.service';
import { ReviewsService } from '../reviews/reviews.service';
import { PaymentsService } from '../payments/payments.service';
import { PlansService } from '../plans/plans.service';
import { PromosService } from '../promos/promos.service';
import { setupBotHandlers, BotServices } from './bot-factory';
import { Clinic } from '../database/entities/clinic.entity';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class ClinicBotsService implements OnModuleInit {
  private readonly logger = new Logger(ClinicBotsService.name);
  private bots = new Map<number, Telegraf>();
  private adminBots = new Map<number, Telegraf>();

  constructor(
    private readonly configService: ConfigService,
    private readonly clinicsService: ClinicsService,
    private readonly usersService: UsersService,
    private readonly servicesService: ServicesService,
    private readonly appointmentsService: AppointmentsService,
    private readonly timeSlotsService: TimeSlotsService,
    private readonly workScheduleService: WorkScheduleService,
    private readonly faqService: FaqService,
    private readonly clinicSettingsService: ClinicSettingsService,
    private readonly reviewsService: ReviewsService,
    private readonly paymentsService: PaymentsService,
    private readonly plansService: PlansService,
    private readonly promosService: PromosService,
  ) {}

  async onModuleInit() {
    const clinics = await this.clinicsService.findActive();
    for (const clinic of clinics) {
      await this.startBot(clinic);
      if (clinic.adminBotToken) await this.startAdminBot(clinic);
    }
    this.logger.log(`${this.bots.size} ta user bot, ${this.adminBots.size} ta admin bot ishga tushirildi`);
  }

  private buildServices(): BotServices {
    return {
      usersService: this.usersService,
      servicesService: this.servicesService,
      appointmentsService: this.appointmentsService,
      timeSlotsService: this.timeSlotsService,
      workScheduleService: this.workScheduleService,
      faqService: this.faqService,
      clinicSettingsService: this.clinicSettingsService,
      reviewsService: this.reviewsService,
      clinicsService: this.clinicsService,
      paymentsService: this.paymentsService,
      plansService: this.plansService,
      promosService: this.promosService,
    };
  }

  getBot(clinicId: number): Telegraf | undefined {
    return this.bots.get(clinicId);
  }

  async startBot(clinic: Clinic): Promise<void> {
    if (this.bots.has(clinic.id)) return;
    const webhookUrl = this.configService.get<string>('app.url');
    const bot = new Telegraf(clinic.botToken);
    const superAdminIds = this.configService.get<number[]>('superAdmin.ids') || [];
    setupBotHandlers(bot, clinic.id, clinic, this.buildServices(), webhookUrl || '', superAdminIds);
    if (webhookUrl) {
      try {
        await bot.telegram.setWebhook(`${webhookUrl}/webhook/${clinic.id}`);
        this.logger.log(`Clinic ${clinic.id} user bot webhook set`);
      } catch (e) {
        this.logger.error(`Clinic ${clinic.id} webhook error: ${e.message}`);
      }
    } else {
      bot.launch().catch((e) => this.logger.error(`Clinic ${clinic.id} polling: ${e.message}`));
    }
    this.bots.set(clinic.id, bot);
  }

  async startAdminBot(clinic: Clinic): Promise<void> {
    if (this.adminBots.has(clinic.id) || !clinic.adminBotToken) return;
    const webhookUrl = this.configService.get<string>('app.url');
    const bot = new Telegraf(clinic.adminBotToken);
    const superAdminIds = this.configService.get<number[]>('superAdmin.ids') || [];
    setupBotHandlers(bot, clinic.id, clinic, this.buildServices(), webhookUrl || '', superAdminIds, true);
    if (webhookUrl) {
      try {
        await bot.telegram.setWebhook(`${webhookUrl}/webhook/admin/${clinic.id}`);
        this.logger.log(`Clinic ${clinic.id} admin bot webhook set`);
      } catch (e) {
        this.logger.error(`Clinic ${clinic.id} admin bot webhook error: ${e.message}`);
      }
    } else {
      bot.launch().catch((e) => this.logger.error(`Clinic ${clinic.id} admin bot polling: ${e.message}`));
    }
    this.adminBots.set(clinic.id, bot);
  }

  async stopBot(clinicId: number): Promise<void> {
    const bot = this.bots.get(clinicId);
    if (bot) {
      try { await bot.telegram.deleteWebhook(); bot.stop(); } catch {}
      this.bots.delete(clinicId);
    }
    await this.stopAdminBot(clinicId);
  }

  async stopAdminBot(clinicId: number): Promise<void> {
    const bot = this.adminBots.get(clinicId);
    if (!bot) return;
    try { await bot.telegram.deleteWebhook(); bot.stop(); } catch {}
    this.adminBots.delete(clinicId);
  }

  async sendMessage(clinicId: number, chatId: number, text: string, extra?: any): Promise<void> {
    const bot = this.bots.get(clinicId) || this.adminBots.get(clinicId);
    if (!bot) return;
    await bot.telegram.sendMessage(chatId, text, extra);
  }

  keepAlive() {
    const appUrl = this.configService.get<string>('app.url');
    if (!appUrl) return;
    const url = `${appUrl}/health`;
    const client = url.startsWith('https') ? https : http;
    client.get(url, () => {}).on('error', () => {});
  }

  async handleWebhook(clinicId: number, update: any): Promise<void> {
    const bot = this.bots.get(clinicId);
    if (!bot) return;
    await (bot as any).handleUpdate(update);
  }

  async handleAdminWebhook(clinicId: number, update: any): Promise<void> {
    const bot = this.adminBots.get(clinicId);
    if (!bot) return;
    await (bot as any).handleUpdate(update);
  }
}
