import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from '../database/entities/service.entity';

const DEFAULT_SERVICES = [
  { name: 'Tish davolash', description: 'Kariyes va boshqa tish kasalliklarini davolash', emoji: '🦷', price: '150,000 - 500,000 so\'m', sortOrder: 1 },
  { name: 'Tish oqartirish', description: 'Professional tish oqartirish protsedurasi', emoji: '✨', price: '800,000 - 1,200,000 so\'m', sortOrder: 2 },
  { name: 'Implantatsiya', description: 'Tish implanti o\'rnatish', emoji: '🔬', price: '3,000,000 - 8,000,000 so\'m', sortOrder: 3 },
  { name: 'Tish protezi', description: 'Olinadigan va qo\'yiladigan protezlar', emoji: '🦾', price: '500,000 - 3,000,000 so\'m', sortOrder: 4 },
  { name: 'Ortodontiya', description: 'Tish qiyshayganligi — breketlar va alignerlar', emoji: '😁', price: '5,000,000 - 15,000,000 so\'m', sortOrder: 5 },
  { name: 'Tish tозалаш', description: 'Professional profilaktik tозалаsh (ultraton)', emoji: '🪥', price: '200,000 - 350,000 so\'m', sortOrder: 6 },
  { name: 'Bolalar stomatologiyasi', description: 'Bolalar uchun maxsus davolash', emoji: '👶', price: '100,000 - 400,000 so\'m', sortOrder: 7 },
  { name: 'Shoshilinch yordam', description: 'Og\'riqni tezda bartaraf etish', emoji: '🚨', price: '200,000 dan', sortOrder: 8 },
];

@Injectable()
export class ServicesService implements OnModuleInit {
  constructor(
    @InjectRepository(Service)
    private readonly servicesRepo: Repository<Service>,
  ) {}

  async onModuleInit() {
    const count = await this.servicesRepo.count();
    if (count === 0) {
      await this.servicesRepo.save(
        DEFAULT_SERVICES.map((s) => this.servicesRepo.create(s)),
      );
    }
  }

  async findAll(): Promise<Service[]> {
    return this.servicesRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async findById(id: number): Promise<Service | null> {
    return this.servicesRepo.findOne({ where: { id } });
  }

  async findAllAdmin(): Promise<Service[]> {
    return this.servicesRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async create(name: string, emoji: string): Promise<Service> {
    const count = await this.servicesRepo.count();
    return this.servicesRepo.save(
      this.servicesRepo.create({ name, emoji, sortOrder: count + 1 }),
    );
  }

  async update(id: number, data: Partial<Pick<Service, 'name' | 'emoji' | 'isActive'>>): Promise<void> {
    await this.servicesRepo.update(id, data);
  }

  async remove(id: number): Promise<void> {
    await this.servicesRepo.delete(id);
  }
}
