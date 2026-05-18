import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('webhook.port') || 3000;
  const nodeEnv = config.get<string>('nodeEnv');

  await app.listen(port);
  console.log(`🚀 QabulBot ishga tushdi | port: ${port} | mode: ${nodeEnv}`);
}

bootstrap();
