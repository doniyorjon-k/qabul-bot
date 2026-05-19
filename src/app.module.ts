import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
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
import { BotModule } from './bot/bot.module';
import { FaqModule } from './faq/faq.module';
import { ClinicSettingsModule } from './clinic-settings/clinic-settings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UsersModule } from './users/users.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { TimeSlotsModule } from './time-slots/time-slots.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WorkScheduleModule } from './work-schedule/work-schedule.module';

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
        entities: [User, Appointment, Service, TimeSlot, WorkSchedule, Faq, ClinicSettings, Review],
        synchronize: true,
        logging: config.get('nodeEnv') === 'development',
      }),
      inject: [ConfigService],
    }),

    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const token = config.get<string>('bot.token');
        const webhookUrl = config.get<string>('webhook.url');

        if (webhookUrl) {
          return {
            token,
            launchOptions: {
              webhook: {
                domain: webhookUrl,
                hookPath: '/webhook',
              },
            },
          };
        }

        return { token };
      },
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    BotModule,
    UsersModule,
    ServicesModule,
    AppointmentsModule,
    TimeSlotsModule,
    WorkScheduleModule,
    NotificationsModule,
    FaqModule,
    ClinicSettingsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
