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

  async findOrCreate(telegramId: number, username?: string): Promise<User> {
    let user = await this.usersRepo.findOne({ where: { telegramId } });
    if (!user) {
      user = this.usersRepo.create({ telegramId, username });
      await this.usersRepo.save(user);
    }
    return user;
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { telegramId } });
  }

  async updateProfile(telegramId: number, data: Partial<User>): Promise<User> {
    await this.usersRepo.update({ telegramId }, data);
    return this.findByTelegramId(telegramId);
  }

  async setAdmin(telegramId: number, isAdmin: boolean): Promise<void> {
    await this.usersRepo.update({ telegramId }, { isAdmin });
  }

  async findAdmins(): Promise<User[]> {
    return this.usersRepo.find({ where: { isAdmin: true } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepo.find({ select: ['id', 'telegramId'] });
  }

  async count(): Promise<number> {
    return this.usersRepo.count();
  }
}
