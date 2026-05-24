import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

@Controller()
export class AppController {
  private adminHtml: string;
  private superAdminHtml: string;

  constructor() {
    const adminPath = join(__dirname, '..', 'public', 'admin', 'index.html');
    this.adminHtml = existsSync(adminPath) ? readFileSync(adminPath, 'utf8') : `<h2>Not found: ${adminPath}</h2>`;

    const saPath = join(__dirname, '..', 'public', 'super-admin', 'index.html');
    this.superAdminHtml = existsSync(saPath) ? readFileSync(saPath, 'utf8') : `<h2>Not found: ${saPath}</h2>`;
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('admin')
  @Get('admin/')
  serveAdmin(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.adminHtml);
  }

  @Get('super-admin')
  @Get('super-admin/')
  serveSuperAdmin(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.superAdminHtml);
  }
}
