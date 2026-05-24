import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('admin')
  @Get('admin/')
  serveAdmin(@Res() res: Response) {
    res.sendFile(join(__dirname, '..', 'public', 'admin', 'index.html'));
  }
}
