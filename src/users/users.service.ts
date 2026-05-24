import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findOrCreate(telegramId: number, clinicId: number, username?: string): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { telegramId, clinic: { id: clinicId } } });
    if (!user) {
      user = this.usersRepo.create({ telegramId, username, clinic: { id: clinicId } as any });
      await this.usersRepo.save(user);
    }
    return user;
  }

  async findByTelegramId(telegramId: number, clinicId: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { telegramId, clinic: { id: clinicId } } });
  }

  async updateProfile(telegramId: number, clinicId: number, data: Partial<User>): Promise<User> {
    const user = await this.findByTelegramId(telegramId, clinicId);
    if (!user) return null;
    await this.usersRepo.update(user.id, data);
    return this.findByTelegramId(telegramId, clinicId);
  }

  async count(clinicId: number): Promise<number> {
    return this.usersRepo.count({ where: { clinic: { id: clinicId } } });
  }

  async findAll(clinicId: number): Promise<User[]> {
    return this.usersRepo.find({ where: { clinic: { id: clinicId } } });
  }

  async findAdmins(clinicId: number): Promise<User[]> {
    return this.usersRepo.find({ where: { clinic: { id: clinicId }, isAdmin: true } });
  }

  async setAdmin(telegramId: number, clinicId: number, isAdmin: boolean): Promise<void> {
    const user = await this.findByTelegramId(telegramId, clinicId);
    if (user) await this.usersRepo.update(user.id, { isAdmin });
  }
}
