import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../database/entities/faq.entity';

const DEFAULT_FAQS = [
  {
    question: '😬 Davolash og\'riqli bo\'ladimi?',
    answer: 'Yo\'q! Biz zamonaviy mahalliy og\'riqsizlantirish (anesteziya) ishlatamiz.\nProtsedura davomida siz deyarli hech narsa sezmasiz.\nAgar og\'riqdan qo\'rqsangiz — shifokorga ayting, u sizga qulay sharoit yaratadi.',
    sortOrder: 1,
  },
  {
    question: '⏱ Qabul qancha vaqt davom etadi?',
    answer: 'Bu muammoning murakkabligiga bog\'liq:\n• Oddiy ko\'rik: 20–30 daqiqa\n• Kariyes davolash: 40–60 daqiqa\n• Implant o\'rnatish: 1–2 soat\n• Tish oqartirish: 1,5–2 soat',
    sortOrder: 2,
  },
  {
    question: '🕐 Ish vaqtingiz qanday?',
    answer: 'Biz har kuni ishlaymiz:\n• Dushanba – Shanba: 09:00 – 18:00\n• Yakshanba: dam olish kuni',
    sortOrder: 3,
  },
  {
    question: '💰 Narxlar qanday?',
    answer: 'Narxlar xizmat turiga qarab farq qiladi.\n"💼 Xizmatlar" bo\'limida har bir xizmat ko\'rsatilgan.\nBatafsil ma\'lumot uchun qo\'ng\'iroq qiling yoki to\'g\'ridan-to\'g\'ri keling — bepul ko\'rik o\'tkazamiz!',
    sortOrder: 4,
  },
  {
    question: '📋 Qanday hujjatlar kerak?',
    answer: 'Birinchi tashrif uchun hech qanday maxsus hujjat shart emas.\nFaqat pasport yoki ID-kartangizni olib keling.',
    sortOrder: 5,
  },
  {
    question: '🔄 Qabulni bekor qilish mumkinmi?',
    answer: 'Ha, albatta. Qabulni bekor qilish uchun:\n• Ushbu botda admin bilan bog\'laning\n• Yoki klinikazimizga qo\'ng\'iroq qiling\nIltimos, 2 soatdan oldin xabar bering.',
    sortOrder: 6,
  },
];

@Injectable()
export class FaqService implements OnModuleInit {
  constructor(
    @InjectRepository(Faq)
    private readonly faqRepo: Repository<Faq>,
  ) {}

  async onModuleInit() {
    const count = await this.faqRepo.count();
    if (count === 0) {
      await this.faqRepo.save(DEFAULT_FAQS.map((f) => this.faqRepo.create(f)));
    }
  }

  async findAll(): Promise<Faq[]> {
    return this.faqRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  async findAllAdmin(): Promise<Faq[]> {
    return this.faqRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async findById(id: number): Promise<Faq | null> {
    return this.faqRepo.findOne({ where: { id } });
  }

  async create(question: string, answer: string): Promise<Faq> {
    const count = await this.faqRepo.count();
    return this.faqRepo.save(this.faqRepo.create({ question, answer, sortOrder: count + 1 }));
  }

  async update(id: number, data: Partial<Pick<Faq, 'question' | 'answer'>>): Promise<void> {
    await this.faqRepo.update(id, data);
  }

  async remove(id: number): Promise<void> {
    await this.faqRepo.delete(id);
  }
}
