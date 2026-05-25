import { Entity, Column, PrimaryGeneratedColumn, OneToOne, ManyToOne, JoinColumn } from 'typeorm';
import { Appointment } from './appointment.entity';
import { Clinic } from './clinic.entity';

@Entity('time_slots')
export class TimeSlot {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

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
