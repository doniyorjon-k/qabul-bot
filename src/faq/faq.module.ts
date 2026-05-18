import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Faq } from '../database/entities/faq.entity';
import { FaqService } from './faq.service';

@Module({
  imports: [TypeOrmModule.forFeature([Faq])],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
