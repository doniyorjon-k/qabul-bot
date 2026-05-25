import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Clinic } from './clinic.entity';

@Entity('clinic_settings')
export class ClinicSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  telegram: string;

  @Column({ nullable: true })
  mapsUrl: string;

  @Column({ nullable: true })
  tgUrl: string;

  @Column({ nullable: true })
  igUrl: string;
}
