import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';

export enum ClinicStatus {
  TRIAL = 'trial',
  ACTIVE = 'active',
  GRACE = 'grace',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  botToken: string;

  @Column({ type: 'json', default: '[]' })
  adminIds: number[];

  @Column({ type: 'enum', enum: ClinicStatus, default: ClinicStatus.TRIAL })
  status: ClinicStatus;

  @Column({ type: 'timestamp', nullable: true })
  trialEndsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionEndsAt: Date | null;

  @Column({ nullable: true })
  currentPlan: string | null;

  @Column({ default: false })
  notified7Days: boolean;

  @Column({ default: false })
  notified3Days: boolean;

  @Column({ default: false })
  notified1Day: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
