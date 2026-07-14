import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface HealthReport {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: { database: 'up' | 'down' };
}

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /**
   * A health check that does not touch its dependencies reports "ok" from a
   * process that cannot serve a single request, and a load balancer keeps
   * sending traffic to it. So this one actually reaches the database.
   */
  async getHealth(): Promise<HealthReport> {
    const base = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', ...base, checks: { database: 'up' } };
    } catch (err) {
      this.logger.error(
        'Health check failed: database unreachable',
        err as Error,
      );
      return { status: 'error', ...base, checks: { database: 'down' } };
    }
  }
}
