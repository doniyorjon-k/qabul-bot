import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisitPayment } from '../database/entities/visit-payment.entity';
import { VisitPaymentsService } from './visit-payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([VisitPayment])],
  providers: [VisitPaymentsService],
  exports: [VisitPaymentsService],
})
export class VisitPaymentsModule {}
