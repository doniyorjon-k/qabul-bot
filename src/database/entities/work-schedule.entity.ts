import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('work_schedule')
export class WorkSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  // Haftalik asosiy jadval: 1=Du, 2=Se, 3=Ch, 4=Pa, 5=Ju, 6=Sh, 7=Ya
  @Column({ type: 'json', default: '[1,2,3,4,5,6]' })
  workDays: number[];

  @Column({ type: 'json', default: '["09:00","10:00","11:00","12:00","14:00","15:00","16:00","17:00"]' })
  workHours: string[];

  // Ish kuniga to'g'ri kelib qolsa ham dam olish (bayramlar, ta'tillar)
  @Column({ type: 'json', default: '[]' })
  blockedDates: string[];

  // Dam olish kuniga to'g'ri kelib qolsa ham ish kuni
  @Column({ type: 'json', default: '[]' })
  extraWorkDates: string[];
}
