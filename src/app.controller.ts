import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

@Controller()
export class AppController {
  private adminHtml: string;

  constructor() {
    const filePath = join(__dirname, '..', 'public', 'admin', 'index.html');
    if (existsSync(filePath)) {
      this.adminHtml = readFileSync(filePath, 'utf8');
    } else {
      this.adminHtml = `<h2>File not found: ${filePath}</h2>`;
    }
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('debug-admin')
  debugAdmin() {
    const filePath = join(__dirname, '..', 'public', 'admin', 'index.html');
    return {
      dirname: __dirname,
      filePath,
      exists: existsSync(filePath),
      htmlLength: this.adminHtml?.length ?? 0,
    };
  }

  @Get('admin')
  @Get('admin/')
  serveAdmin(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(this.adminHtml);
  }
}
