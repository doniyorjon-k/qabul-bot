import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../database/entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly repo: Repository<Review>,
  ) {}

  async create(clinicId: number, data: {
    telegramId: number;
    rating: number;
    comment?: string;
    clientName?: string;
    serviceName?: string;
    appointmentDate?: string;
  }): Promise<Review> {
    return this.repo.save(this.repo.create({ ...data, clinic: { id: clinicId } as any }));
  }

  async findAll(clinicId: number, limit = 20): Promise<Review[]> {
    return this.repo.find({ where: { clinic: { id: clinicId } }, order: { createdAt: 'DESC' }, take: limit });
  }

  async getStats(clinicId: number): Promise<{ total: number; avg: number }> {
    const result = await this.repo
      .createQueryBuilder('r')
      .where('r.clinic_id = :clinicId', { clinicId })
      .select('COUNT(*)', 'total')
      .addSelect('AVG(r.rating)', 'avg')
      .getRawOne();
    return {
      total: parseInt(result.total) || 0,
      avg: parseFloat(parseFloat(result.avg || '0').toFixed(1)),
    };
  }
}
