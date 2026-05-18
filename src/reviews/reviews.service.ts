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

  async create(data: {
    telegramId: number;
    rating: number;
    comment?: string;
    clientName?: string;
    serviceName?: string;
    appointmentDate?: string;
  }): Promise<Review> {
    return this.repo.save(this.repo.create(data));
  }

  async findAll(limit = 20): Promise<Review[]> {
    return this.repo.find({ order: { createdAt: 'DESC' }, take: limit });
  }

  async getStats(): Promise<{ total: number; avg: number }> {
    const result = await this.repo
      .createQueryBuilder('r')
      .select('COUNT(*)', 'total')
      .addSelect('AVG(r.rating)', 'avg')
      .getRawOne();
    return {
      total: parseInt(result.total) || 0,
      avg: parseFloat(parseFloat(result.avg || '0').toFixed(1)),
    };
  }
}
