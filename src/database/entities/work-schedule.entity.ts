import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('work_schedule')
export class WorkSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic)
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ type: 'json', default: '[1,2,3,4,5,6]' })
  workDays: number[];

  @Column({ type: 'json', default: '["09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30"]' })
  workHours: string[];

  @Column({ type: 'json', default: '[]' })
  blockedDates: string[];

  @Column({ type: 'json', default: '[]' })
  extraWorkDates: string[];
}
