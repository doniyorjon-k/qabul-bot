import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('faqs')
export class Faq {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column()
  question: string;

  @Column('text')
  answer: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;
}
