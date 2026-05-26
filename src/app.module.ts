import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { User } from './database/entities/user.entity';
import { Appointment } from './database/entities/appointment.entity';
import { Service } from './database/entities/service.entity';
import { TimeSlot } from './database/entities/time-slot.entity';
import { WorkSchedule } from './database/entities/work-schedule.entity';
import { Faq } from './database/entities/faq.entity';
import { ClinicSettings } from './database/entities/clinic-settings.entity';
import { Review } from './database/entities/review.entity';
import { Clinic } from './database/entities/clinic.entity';
import { Plan } from './database/entities/plan.entity';
import { Promo } from './database/entities/promo.entity';
import { Payment } from './database/entities/payment.entity';
import { Broadcast } from './database/entities/broadcast.entity';
import { AdminApiModule } from './admin-api/admin-api.module';
import { FaqModule } from './faq/faq.module';
import { ClinicSettingsModule } from './clinic-settings/clinic-settings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TimeSlotsModule } from './time-slots/time-slots.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WorkScheduleModule } from './work-schedule/work-schedule.module';
import { ClinicsModule } from './clinics/clinics.module';
import { PlansModule } from './plans/plans.module';
import { PromosModule } from './promos/promos.module';
import { PaymentsModule } from './payments/payments.module';
import { ClinicBotsModule } from './clinic-bots/clinic-bots.module';
import { WebhookModule } from './webhook/webhook.module';
import { SuperAdminBotModule } from './super-admin/super-admin-bot.module';
import { SuperAdminApiModule } from './super-admin/super-admin-api.module';
import { PublicApiModule } from './public-api/public-api.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        entities: [
          User, Appointment, Service, TimeSlot, WorkSchedule,
          Faq, ClinicSettings, Review, Clinic, Plan, Promo, Payment, Broadcast,
        ],
        synchronize: true,
        logging: config.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    ClinicBotsModule,
    WebhookModule,
    SuperAdminBotModule,
    SuperAdminApiModule,
    PublicApiModule,
    AdminApiModule,
    UsersModule,
    ServicesModule,
    AppointmentsModule,
    TimeSlotsModule,
    WorkScheduleModule,
    NotificationsModule,
    FaqModule,
    ClinicSettingsModule,
    ReviewsModule,
    ClinicsModule,
    PlansModule,
    PromosModule,
    PaymentsModule,
  ],
})
export class AppModule {}
