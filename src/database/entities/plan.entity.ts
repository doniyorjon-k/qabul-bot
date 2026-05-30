import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  slug: string; // 'monthly' | 'yearly'

  @Column({ type: 'int' })
  price: number;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isMostPopular: boolean;

  @Column({ nullable: true, type: 'text' })
  bonus: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
