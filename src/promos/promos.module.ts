import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promo } from '../database/entities/promo.entity';
import { PromosService } from './promos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promo])],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}
