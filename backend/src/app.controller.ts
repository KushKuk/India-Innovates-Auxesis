import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): string {
    return 'Secure Vote Flow API is running! (Global prefix is /api)';
  }
}
