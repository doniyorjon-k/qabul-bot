import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('promos')
export class Promo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  // foiz yoki summa (biri null bo'ladi)
  @Column({ type: 'int', nullable: true })
  discountPercent: number | null;

  @Column({ type: 'int', nullable: true })
  discountAmount: number | null;

  @Column({ type: 'date' })
  validFrom: string;

  @Column({ type: 'date' })
  validTo: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  notificationSent: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
