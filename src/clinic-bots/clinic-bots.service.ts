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
    }
    this.logger.log(`${this.bots.size} ta bot ishga tushirildi`);
  }

  getBot(clinicId: number): Telegraf | undefined {
    return this.bots.get(clinicId);
  }

  async startBot(clinic: Clinic): Promise<void> {
    if (this.bots.has(clinic.id)) return;

    const webhookUrl = this.configService.get<string>('app.url');
    const bot = new Telegraf(clinic.botToken);

    const services: BotServices = {
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

    const superAdminIds = this.configService.get<number[]>('superAdmin.ids') || [];
    setupBotHandlers(bot, clinic.id, clinic, services, webhookUrl || '', superAdminIds);

    if (webhookUrl) {
      const webhookPath = `/webhook/${clinic.id}`;
      try {
        await bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`);
        this.logger.log(`Clinic ${clinic.id} webhook: ${webhookUrl}${webhookPath}`);
      } catch (e) {
        this.logger.error(`Clinic ${clinic.id} webhook setup error: ${e.message}`);
      }
    } else {
      bot.launch().catch((e) => this.logger.error(`Clinic ${clinic.id} polling error: ${e.message}`));
    }

    this.bots.set(clinic.id, bot);
  }

  async stopBot(clinicId: number): Promise<void> {
    const bot = this.bots.get(clinicId);
    if (!bot) return;
    try {
      await bot.telegram.deleteWebhook();
      bot.stop();
    } catch {}
    this.bots.delete(clinicId);
  }

  // Called from NotificationsService — send to users of a specific clinic
  async sendMessage(clinicId: number, chatId: number, text: string, extra?: any): Promise<void> {
    const bot = this.bots.get(clinicId);
    if (!bot) return;
    await bot.telegram.sendMessage(chatId, text, extra);
  }

  // Keep-alive ping for a clinic's app URL
  keepAlive() {
    const appUrl = this.configService.get<string>('app.url');
    if (!appUrl) return;
    const url = `${appUrl}/health`;
    const client = url.startsWith('https') ? https : http;
    client.get(url, () => {}).on('error', () => {});
  }

  // Handle incoming webhook update for a clinic
  async handleWebhook(clinicId: number, update: any): Promise<void> {
    const bot = this.bots.get(clinicId);
    if (!bot) return;
    await (bot as any).handleUpdate(update);
  }
}
