import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Appointment } from './appointment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'bigint',
    unique: true,
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  telegramId: number;

  @Column({ nullable: true })
  fullName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  username: string;

  @Column({ default: false })
  isAdmin: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Appointment, (appointment) => appointment.user)
  appointments: Appointment[];
}
