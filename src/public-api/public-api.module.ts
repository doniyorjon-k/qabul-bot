import { Module } from '@nestjs/common';
import { PublicApiController } from './public-api.controller';
import { PlansModule } from '../plans/plans.module';

@Module({
  imports: [PlansModule],
  controllers: [PublicApiController],
})
export class PublicApiModule {}
