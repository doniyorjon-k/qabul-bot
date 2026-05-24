import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../database/entities/service.entity';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly servicesRepo: Repository<Service>,
  ) {}

  async findAll(clinicId: number): Promise<Service[]> {
    return this.servicesRepo.find({
      where: { clinic: { id: clinicId }, isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findById(id: number, clinicId: number): Promise<Service | null> {
    return this.servicesRepo.findOne({ where: { id, clinic: { id: clinicId } } });
  }

  async findAllAdmin(clinicId: number): Promise<Service[]> {
    return this.servicesRepo.find({
      where: { clinic: { id: clinicId } },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(clinicId: number, name: string, emoji: string): Promise<Service> {
    const count = await this.servicesRepo.count({ where: { clinic: { id: clinicId } } });
    return this.servicesRepo.save(
      this.servicesRepo.create({ name, emoji, sortOrder: count + 1, clinic: { id: clinicId } as any }),
    );
  }

  async update(id: number, data: Partial<Pick<Service, 'name' | 'emoji' | 'isActive'>>): Promise<void> {
    await this.servicesRepo.update(id, data);
  }

  async remove(id: number): Promise<void> {
    await this.servicesRepo.delete(id);
  }
}
