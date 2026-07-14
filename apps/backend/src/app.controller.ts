import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService, HealthReport } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get hello message' })
  @ApiResponse({ status: 200, description: 'Returns hello message.' })
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * Readiness: 200 only while the process can actually serve requests, 503 the
   * moment the database is unreachable, so a load balancer stops routing here.
   * Point orchestrator readiness probes and the container HEALTHCHECK at this.
   */
  @Get('health')
  @ApiOperation({ summary: 'Readiness check — verifies the database' })
  @ApiResponse({ status: 200, description: 'Service is healthy.' })
  @ApiResponse({ status: 503, description: 'A dependency is unavailable.' })
  async getHealth(): Promise<HealthReport> {
    const report = await this.appService.getHealth();

    if (report.status !== 'ok') {
      throw new ServiceUnavailableException(report);
    }

    return report;
  }

  /**
   * Liveness: is the process up at all? Deliberately checks nothing else — a
   * liveness probe that fails on a database blip would restart healthy pods and
   * turn a recoverable outage into a crash loop.
   */
  @Get('health/live')
  @ApiOperation({ summary: 'Liveness check — process only, no dependencies' })
  @ApiResponse({ status: 200, description: 'Process is alive.' })
  getLiveness(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
