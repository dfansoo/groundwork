import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role } from '../src/types/role.enum';

/**
 * Boots the real application — real module graph, real guards, real database —
 * and configures it exactly as main.ts does.
 *
 * Everything else in these tests mocks the repository layer, which means the
 * guards are only ever tested in isolation, never as something actually attached
 * to a route. A controller that forgot its @UseGuards would sail through every
 * unit test in the suite. That is what this catches.
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({
    rawBody: true,
    bodyParser: true,
  });
  configureApp(app);
  await app.init();

  return app;
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/**
 * Creates a real user with real roles and signs a token the way AuthService does,
 * so JwtAuthGuard and PermissionsGuard see exactly what they see in production.
 */
export async function createUser(
  app: INestApplication,
  roles: Role[],
  password?: string,
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService, { strict: false });

  const email = `int-${randomUUID()}@example.test`;
  const user = await prisma.user.create({
    data: {
      email,
      username: 'Integration Probe',
      password: password ? await bcrypt.hash(password, 10) : null,
      roles: { create: roles.map((role) => ({ role })) },
    },
  });

  const token = jwt.sign({
    sub: user.id,
    email: user.email,
    username: user.username,
    roles,
  });

  return { id: user.id, email, token };
}

/** Users created by a spec, newest first, so dependent rows unwind cleanly. */
export async function deleteUsers(
  app: INestApplication,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const prisma = app.get(PrismaService);
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
