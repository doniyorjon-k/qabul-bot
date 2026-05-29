import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clinic } from './clinic.entity';
import { Appointment } from './appointment.entity';
import { User } from './user.entity';

export enum VisitPaymentStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  UNPAID = 'unpaid',
}

@Entity('visit_payments')
export class VisitPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column('jsonb')
  items: { serviceName: string; price: number }[];

  @Column({ type: 'int', default: 0 })
  totalAmount: number;

  @Column({ type: 'int', default: 0 })
  paidAmount: number;

  @Column({ type: 'enum', enum: VisitPaymentStatus })
  status: VisitPaymentStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
