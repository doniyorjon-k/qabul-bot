import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('broadcasts')
export class Broadcast {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  message: string;

  // 'all' | 'active' | 'trial' | 'expired'
  @Column({ default: 'all' })
  target: string;

  @Column({ type: 'int', default: 0 })
  sentCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
