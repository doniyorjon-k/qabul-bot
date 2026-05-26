import { Controller, Get } from '@nestjs/common';
import { PlansService } from '../plans/plans.service';

@Controller('api/public')
export class PublicApiController {
  constructor(private readonly plansService: PlansService) {}

  @Get('pricing')
  async getPricing() {
    const plans = await this.plansService.findAll();
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      durationDays: p.durationDays,
    }));
  }
}
