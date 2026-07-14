import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, createUser, deleteUsers, TestUser } from './setup';
import { Role } from '../src/types/role.enum';

const PASSWORD = 'CorrectHorse123!';

/**
 * The unit tests prove AuthService locks after ten failures. They cannot prove
 * the endpoint does, because the endpoint is where the guard, the throttler and
 * the service actually meet.
 */
describe('login lockout over HTTP', () => {
  let app: INestApplication;
  let http: App;
  let victim: TestUser;
  const created: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer() as App;
  }, 30_000);

  beforeEach(async () => {
    victim = await createUser(app, [Role.USER], PASSWORD);
    created.push(victim.id);
  });

  afterAll(async () => {
    await deleteUsers(app, created);
    await app.close();
  });

  const login = (email: string, password: string) =>
    request(http).post('/v1/auth/login').send({ email, password });

  it('accepts the right password', async () => {
    const res = await login(victim.email, PASSWORD).expect(201);

    expect(res.body.data.access_token).toBeDefined();
  });

  it('401s a wrong password', async () => {
    await login(victim.email, 'wrong').expect(401);
  });

  it('locks the account after ten consecutive failures', async () => {
    for (let i = 0; i < 10; i++) {
      await login(victim.email, `wrong-${i}`).expect(401);
    }

    // The eleventh attempt is refused before the password is even considered —
    // and crucially, the CORRECT password is refused too. That is what makes it
    // a lockout rather than a slow-down.
    const res = await login(victim.email, PASSWORD).expect(403);
    expect(res.body.message).toMatch(/too many failed attempts/i);
  }, 30_000);

  it('does not lock when a success interrupts the run — failures must be consecutive', async () => {
    for (let i = 0; i < 9; i++) {
      await login(victim.email, `wrong-${i}`).expect(401);
    }

    await login(victim.email, PASSWORD).expect(201);

    // The counter was reset, so this is failure #1 of a fresh run, not #10.
    await login(victim.email, 'wrong-again').expect(401);
    await login(victim.email, PASSWORD).expect(201);
  }, 30_000);

  it('gives an unknown address the same 401, with no account to lock', async () => {
    for (let i = 0; i < 11; i++) {
      await login('definitely-not-a-user@example.test', `wrong-${i}`).expect(
        401,
      );
    }
  }, 30_000);
});
