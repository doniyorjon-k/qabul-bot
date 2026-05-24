import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../database/entities/faq.entity';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
  ) {}

  async findAll(clinicId: number): Promise<Faq[]> {
    return this.faqRepo.find({ where: { clinic: { id: clinicId }, isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findAllAdmin(clinicId: number): Promise<Faq[]> {
    return this.faqRepo.find({ where: { clinic: { id: clinicId } }, order: { sortOrder: 'ASC' } });
  }

  async findById(id: number): Promise<Faq | null> {
    return this.faqRepo.findOne({ where: { id } });
  }

  async create(clinicId: number, question: string, answer: string): Promise<Faq> {
    const count = await this.faqRepo.count({ where: { clinic: { id: clinicId } } });
    return this.faqRepo.save(this.faqRepo.create({ question, answer, sortOrder: count + 1, clinic: { id: clinicId } as any }));
  }

  async update(id: number, data: Partial<Pick<Faq, 'question' | 'answer'>>): Promise<void> {
    await this.faqRepo.update(id, data);
  }

  async remove(id: number): Promise<void> {
    await this.faqRepo.delete(id);
  }
}
