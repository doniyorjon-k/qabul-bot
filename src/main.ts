import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('webhook.port') || 3000;

  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableCors();
  const nodeEnv = config.get<string>('nodeEnv');

  await app.listen(port);
  console.log(`🚀 QabulBot ishga tushdi | port: ${port} | mode: ${nodeEnv}`);
}

bootstrap();
