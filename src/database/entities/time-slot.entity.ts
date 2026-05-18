import { Entity, Column, PrimaryGeneratedColumn, OneToOne } from 'typeorm';
import { Appointment } from './appointment.entity';

@Entity('time_slots')
export class TimeSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string;

  @Column({
    type: 'time',
    transformer: {
      to: (v: string) => v,
      from: (v: string) => (v ? v.slice(0, 5) : v),
    },
  })
  time: string;

  @Column({ default: false })
  isBooked: boolean;

  @OneToOne(() => Appointment, (appointment) => appointment.timeSlot)
  appointment: Appointment;
}
