import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn()
  id: number;

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
