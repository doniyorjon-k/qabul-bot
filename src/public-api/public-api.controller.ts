import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PlansService } from '../plans/plans.service';
import { ClinicsService } from '../clinics/clinics.service';
import { ClinicBotsService } from '../clinic-bots/clinic-bots.service';
import { SuperAdminBotService } from '../super-admin/super-admin-bot.service';

@Controller('api/public')
export class PublicApiController {
  private readonly logger = new Logger(PublicApiController.name);

  constructor(
    private readonly plansService: PlansService,
    private readonly clinicsService: ClinicsService,
    private readonly clinicBotsService: ClinicBotsService,
    private readonly superAdminBotService: SuperAdminBotService,
  ) {}

  @Get('pricing')
  async getPricing() {
    const plans = await this.plansService.findAll();
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      durationDays: p.durationDays,
      isMostPopular: p.isMostPopular,
      bonus: p.bonus,
    }));
  }

  @Post('register')
  async register(
    @Body()
    body: {
      clinicName: string;
      botToken: string;
      ownerName: string;
      phone: string;
      adminTelegramId?: number;
    },
  ) {
    const { clinicName, botToken, ownerName, phone, adminTelegramId } = body;

    if (!clinicName?.trim() || !botToken?.trim() || !ownerName?.trim() || !phone?.trim()) {
      throw new BadRequestException("Barcha majburiy maydonlarni to'ldiring");
    }

    // Validate bot token via Telegram API
    const botInfo = await this.validateBotToken(botToken.trim());
    if (!botInfo) {
      throw new BadRequestException(
        "Bot token noto'g'ri. @BotFather dan olgan tokeningizni to'g'ri nusxalang.",
      );
    }

    // Check for duplicate token
    const existing = await this.clinicsService.findByBotToken(botToken.trim());
    if (existing) {
      throw new ConflictException('Bu token allaqachon tizimda ro\'yxatdan o\'tgan.');
    }

    // Create clinic
    let clinic;
    try {
      clinic = await this.clinicsService.create({
        name: clinicName.trim(),
        botToken: botToken.trim(),
        adminIds: adminTelegramId ? [Number(adminTelegramId)] : [],
      });
    } catch (e) {
      this.logger.error(`Clinic create error: ${e.message}`);
      throw new InternalServerErrorException('Klinika yaratishda xatolik yuz berdi.');
    }

    // Start bot
    try {
      await this.clinicBotsService.startBot(clinic);
    } catch (e) {
      this.logger.error(`startBot error for clinic ${clinic.id}: ${e.message}`);
      // Delete the clinic if bot failed to start
      await this.clinicsService.update(clinic.id, { deletedAt: new Date() } as any);
      throw new BadRequestException(
        'Bot ishga tushmadi. Token to\'g\'ri ekanligini tekshiring — bot boshqa tizimda ishlamayaptiganligini ham ko\'ring.',
      );
    }

    // Notify super admin
    const msg =
      `🆕 *Yangi klinika ro'yxatdan o'tdi!*\n\n` +
      `🏥 Klinika: ${clinicName}\n` +
      `👤 Egasi: ${ownerName}\n` +
      `📱 Telefon: ${phone}\n` +
      `🤖 Bot: @${botInfo.username}\n\n` +
      `Sinov muddati: 14 kun`;
    await this.superAdminBotService.notify(msg, { parse_mode: 'Markdown' });

    this.logger.log(`New self-registered clinic: ${clinicName} (@${botInfo.username})`);

    return {
      success: true,
      botUsername: botInfo.username,
      botName: botInfo.firstName,
    };
  }

  private async validateBotToken(
    token: string,
  ): Promise<{ username: string; firstName: string } | null> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await res.json()) as any;
      if (data.ok && data.result?.username) {
        return { username: data.result.username, firstName: data.result.first_name };
      }
      return null;
    } catch {
      return null;
    }
  }
}
