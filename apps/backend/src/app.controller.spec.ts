import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ServiceUnavailableException } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const makePrisma = () => ({ $queryRaw: jest.fn() }) as any;

const build = (prisma: any) => new AppController(new AppService(prisma));

describe('health', () => {
  let prisma: any;
  beforeEach(() => {
    prisma = makePrisma();
  });

  it('reports ok while the database answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const res = await build(prisma).getHealth();

    expect(res.status).toBe('ok');
    expect(res.checks.database).toBe('up');
  });

  // The whole point. A 200 from a process that cannot reach its database keeps a
  // load balancer sending traffic to an instance that can serve nothing.
  it('fails with 503 when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(build(prisma).getHealth()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('says which dependency is down in the 503 body', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    const err = await build(prisma)
      .getHealth()
      .catch((e: ServiceUnavailableException) => e);

    expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
      status: 'error',
      checks: { database: 'down' },
    });
  });

  // Liveness must not depend on the database: restarting a healthy pod because
  // Postgres blinked turns a recoverable outage into a crash loop.
  it('liveness stays up regardless of the database', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(build(prisma).getLiveness().status).toBe('ok');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
