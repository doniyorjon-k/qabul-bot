import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column()
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ nullable: true })
  clientName: string;

  @Column({ nullable: true })
  serviceName: string;

  @Column({
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  telegramId: number;

  @Column({ nullable: true })
  appointmentDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
