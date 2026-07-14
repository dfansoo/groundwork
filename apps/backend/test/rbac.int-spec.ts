import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  createTestApp,
  createUser,
  deleteUsers,
  bearer,
  TestUser,
} from './setup';
import { Role } from '../src/types/role.enum';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Proves the guards are ATTACHED, not merely correct.
 *
 * Every other backend test mocks the repository and calls a service directly, so
 * a controller that lost its @UseGuards(JwtAuthGuard, PermissionsGuard) — or a
 * @RequirePermissions that named the wrong permission — would still pass all of
 * them. These requests go through the real HTTP stack: router, global pipes,
 * guards, controller, Prisma, Postgres.
 */
describe('RBAC enforcement over HTTP', () => {
  let app: INestApplication;
  let http: App;
  const created: string[] = [];

  let user: TestUser;
  let viewer: TestUser;
  let editor: TestUser;
  let admin: TestUser;
  let superAdmin: TestUser;

  beforeAll(async () => {
    app = await createTestApp();
    http = app.getHttpServer() as App;

    user = await createUser(app, [Role.USER]);
    viewer = await createUser(app, [Role.VIEWER]);
    editor = await createUser(app, [Role.EDITOR]);
    admin = await createUser(app, [Role.ADMIN]);
    superAdmin = await createUser(app, [Role.SUPER_ADMIN]);
    created.push(user.id, viewer.id, editor.id, admin.id, superAdmin.id);
  }, 30_000);

  afterAll(async () => {
    await deleteUsers(app, created);
    await app.close();
  });

  describe('authentication', () => {
    it('rejects an unauthenticated request to a guarded route', async () => {
      await request(http).get('/v1/admin/items').expect(401);
    });

    it('rejects a garbage token', async () => {
      await request(http)
        .get('/v1/admin/items')
        .set(bearer('not-a-jwt'))
        .expect(401);
    });

    // The signature is what makes a role claim trustworthy. Flip one character
    // and the whole thing has to fall over.
    it('rejects a token whose signature has been tampered with', async () => {
      const [header, payload, sig] = superAdmin.token.split('.');
      const forged = `${header}.${payload}.${sig.slice(0, -2)}xx`;

      await request(http)
        .get('/v1/admin/items')
        .set(bearer(forged))
        .expect(401);
    });

    it('lets an authenticated user read their own profile', async () => {
      const res = await request(http)
        .get('/v1/auth/profile')
        .set(bearer(user.token))
        .expect(200);

      expect(res.body.data.email).toBe(user.email);
    });

    // The lockout bookkeeping is not the client's business.
    it('never exposes password or lockout columns on the profile', async () => {
      const res = await request(http)
        .get('/v1/auth/profile')
        .set(bearer(user.token))
        .expect(200);

      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('lockedUntil');
      expect(res.body.data).not.toHaveProperty('failedLoginAttempts');
    });
  });

  describe('items', () => {
    it('is public to read on the public route', async () => {
      await request(http).get('/v1/items').expect(200);
    });

    it('403s a plain USER on the admin route — authenticated is not authorised', async () => {
      await request(http)
        .get('/v1/admin/items')
        .set(bearer(user.token))
        .expect(403);
    });

    it('lets a VIEWER read', async () => {
      await request(http)
        .get('/v1/admin/items')
        .set(bearer(viewer.token))
        .expect(200);
    });

    it('403s a VIEWER trying to write — ITEMS_READ is not ITEMS_WRITE', async () => {
      await request(http)
        .post('/v1/admin/items')
        .set(bearer(viewer.token))
        .send({ title: 'Viewer should not be able to create this' })
        .expect(403);
    });

    it('lets an EDITOR write, and cleans up after itself', async () => {
      // A fixed title would collide with the row a previous run left behind.
      const title = `Editor made this ${randomUUID()}`;

      const res = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title })
        .expect(201);

      const id = res.body.data.id;
      expect(id).toBeDefined();

      await request(http)
        .delete(`/v1/admin/items/${id}`)
        .set(bearer(editor.token))
        .expect(204);
    });

    // Regression: the unique index on slug spans soft-deleted rows, so deleting
    // an item used to reserve its title forever — and the next create with that
    // title died on the constraint as a 500.
    it('lets a title be used again after the item is deleted', async () => {
      const title = `Reusable ${randomUUID()}`;

      const first = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title })
        .expect(201);

      await request(http)
        .delete(`/v1/admin/items/${first.body.data.id}`)
        .set(bearer(editor.token))
        .expect(204);

      const second = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title })
        .expect(201);

      await request(http)
        .delete(`/v1/admin/items/${second.body.data.id}`)
        .set(bearer(editor.token))
        .expect(204);
    });

    it('409s a duplicate title rather than 500ing on the constraint', async () => {
      const title = `Duplicate ${randomUUID()}`;

      const first = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title })
        .expect(201);

      await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title })
        .expect(409);

      await request(http)
        .delete(`/v1/admin/items/${first.body.data.id}`)
        .set(bearer(editor.token))
        .expect(204);
    });
  });

  describe('staff', () => {
    it('403s an EDITOR — no STAFF_READ', async () => {
      await request(http)
        .get('/v1/admin/staff')
        .set(bearer(editor.token))
        .expect(403);
    });

    it('lets an ADMIN read staff', async () => {
      await request(http)
        .get('/v1/admin/staff')
        .set(bearer(admin.token))
        .expect(200);
    });

    // The distinction the whole ROLE_PERMISSIONS map exists to draw: ADMIN can
    // see who the staff are, but only SUPER_ADMIN can grant roles.
    it('403s an ADMIN trying to create staff — STAFF_READ without STAFF_WRITE', async () => {
      await request(http)
        .post('/v1/admin/staff')
        .set(bearer(admin.token))
        .send({
          email: 'should-never-exist@example.test',
          username: 'Nope',
          password: 'hunter22',
          roles: [Role.EDITOR],
        })
        .expect(403);

      const prisma = app.get(PrismaService);
      const leaked = await prisma.user.findUnique({
        where: { email: 'should-never-exist@example.test' },
      });
      expect(leaked).toBeNull();
    });

    it('lets a SUPER_ADMIN create staff', async () => {
      const email = `int-created-${Date.now()}@example.test`;
      const res = await request(http)
        .post('/v1/admin/staff')
        .set(bearer(superAdmin.token))
        .send({
          email,
          username: 'Made By Super',
          password: 'hunter22',
          roles: [Role.EDITOR],
        })
        .expect(201);

      created.push(res.body.data.id);
      expect(res.body.data.roles).toEqual([Role.EDITOR]);
    });
  });

  describe('audit', () => {
    it('403s an EDITOR — no AUDIT_READ', async () => {
      await request(http)
        .get('/v1/admin/audit-events')
        .set(bearer(editor.token))
        .expect(403);
    });

    it('lets an ADMIN read the audit log', async () => {
      await request(http)
        .get('/v1/admin/audit-events')
        .set(bearer(admin.token))
        .expect(200);
    });
  });

  describe('the auth exchange', () => {
    // This endpoint mints a backend session from a claimed identity. The shared
    // secret is the only thing standing in front of it.
    it('401s without the exchange secret', async () => {
      await request(http)
        .post('/v1/auth/exchange')
        .send({
          email: 'attacker@example.test',
          username: 'Attacker',
          provider: 'google',
          providerAccountId: '1',
          emailVerifiedAt: new Date().toISOString(),
        })
        .expect(401);
    });

    it('401s with the wrong exchange secret', async () => {
      await request(http)
        .post('/v1/auth/exchange')
        .set('x-auth-exchange-secret', 'wrong')
        .send({
          email: 'attacker@example.test',
          username: 'Attacker',
          provider: 'google',
          providerAccountId: '1',
          emailVerifiedAt: new Date().toISOString(),
        })
        .expect(401);
    });
  });

  describe('validation', () => {
    it('422s an unknown property rather than silently dropping it', async () => {
      const res = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({ title: 'Fine', isAdmin: true })
        .expect(422);

      expect(res.body.message).toMatch(/validation failed/i);
    });

    it('422s a missing required field, with the offending property named', async () => {
      const res = await request(http)
        .post('/v1/admin/items')
        .set(bearer(editor.token))
        .send({})
        .expect(422);

      expect(
        res.body.details.map((d: { property: string }) => d.property),
      ).toContain('title');
    });
  });

  describe('health', () => {
    it('reports the database as up', async () => {
      const res = await request(http).get('/health').expect(200);

      expect(res.body.data.checks.database).toBe('up');
    });

    it('serves liveness without a token', async () => {
      await request(http).get('/health/live').expect(200);
    });
  });
});
