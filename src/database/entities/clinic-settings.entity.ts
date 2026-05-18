import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('clinic_settings')
export class ClinicSettings {
  @PrimaryGeneratedColumn()
  id: number;

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
