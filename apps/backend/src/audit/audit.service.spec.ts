import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let repo: any;
  let svc: AuditService;

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'e1',
    actorId: 'admin-1',
    action: 'staff.create',
    entity: 'User',
    entityId: 'user-9',
    meta: { role: 'ADMIN' },
    createdAt: new Date('2026-07-09T10:00:00.000Z'),
    ...over,
  });
  const actor = (id: string, roles: string[]) => ({
    id,
    username: `name-${id}`,
    email: `${id}@acme.test`,
    roles: roles.map((role) => ({ role })),
  });

  beforeEach(() => {
    repo = {
      create: jest.fn(async () => ({})),
      findMany: jest.fn(async () => [] as any[]),
      count: jest.fn(async () => 0),
      findUserIdsByRole: jest.fn(async () => [] as string[]),
      findActorsByIds: jest.fn(async () => [] as any[]),
    };
    svc = new AuditService(repo);
  });

  it('record persists via the repository', async () => {
    await svc.record({
      actorId: 'admin-1',
      action: 'staff.create',
      entity: 'User',
      entityId: 'user-9',
      meta: { role: 'ADMIN' },
    });
    expect(repo.create).toHaveBeenCalledWith({
      actorId: 'admin-1',
      action: 'staff.create',
      entity: 'User',
      entityId: 'user-9',
      meta: { role: 'ADMIN' },
    });
  });

  it('list resolves the actor into username/email/roles', async () => {
    repo.findMany.mockResolvedValue([row()]);
    repo.count.mockResolvedValue(1);
    repo.findActorsByIds.mockResolvedValue([actor('admin-1', ['SUPER_ADMIN'])]);

    const res = await svc.list({ page: 1, limit: 20, order: 'desc' } as any);

    expect(res.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    expect(res.items[0].actor).toEqual({
      id: 'admin-1',
      username: 'name-admin-1',
      email: 'admin-1@acme.test',
      roles: ['SUPER_ADMIN'],
    });
  });

  it('list maps a null actorId to actor: null (System)', async () => {
    repo.findMany.mockResolvedValue([row({ actorId: null })]);
    repo.count.mockResolvedValue(1);

    const res = await svc.list({ page: 1, limit: 20, order: 'desc' } as any);

    expect(res.items[0].actor).toBeNull();
    expect(repo.findActorsByIds).toHaveBeenCalledWith([]);
  });

  it('list maps a present-but-deleted actor to actor: null', async () => {
    repo.findMany.mockResolvedValue([row({ actorId: 'ghost' })]);
    repo.count.mockResolvedValue(1);
    repo.findActorsByIds.mockResolvedValue([]); // user no longer exists

    const res = await svc.list({ page: 1, limit: 20, order: 'desc' } as any);

    expect(res.items[0].actor).toBeNull();
  });

  it('role filter constrains actorId to the users holding that role', async () => {
    repo.findUserIdsByRole.mockResolvedValue(['admin-1', 'admin-2']);

    await svc.list({ page: 1, limit: 20, order: 'desc', role: 'ADMIN' } as any);

    expect(repo.findUserIdsByRole).toHaveBeenCalledWith('ADMIN');
    const where = repo.findMany.mock.calls[0][0];
    expect(where.actorId).toEqual({ in: ['admin-1', 'admin-2'] });
  });

  it('role filter with no matching users yields an empty (in: []) filter, not an unfiltered list', async () => {
    repo.findUserIdsByRole.mockResolvedValue([]);

    await svc.list({
      page: 1,
      limit: 20,
      order: 'desc',
      role: 'EDITOR',
    } as any);

    const where = repo.findMany.mock.calls[0][0];
    expect(where.actorId).toEqual({ in: [] });
  });

  it('builds inclusive date bounds (date-only "to" covers the whole day)', async () => {
    await svc.list({
      page: 1,
      limit: 20,
      order: 'desc',
      from: '2026-07-01',
      to: '2026-07-09',
    } as any);

    const where = repo.findMany.mock.calls[0][0];
    expect(where.createdAt.gte).toEqual(new Date('2026-07-01'));
    expect(where.createdAt.lte).toEqual(new Date('2026-07-09T23:59:59.999Z'));
  });

  it('exportCsv emits a header row and one line per event', async () => {
    repo.findMany.mockResolvedValue([
      row({
        actorId: null,
        action: 'files.delete',
        entity: 'FileAsset',
        entityId: 'asset-3',
      }),
    ]);

    const csv = await svc.exportCsv({ order: 'desc' } as any);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Timestamp,User,Email,Roles,Action,Entity,Entity ID');
    expect(lines[1]).toBe(
      '2026-07-09T10:00:00.000Z,System,,,files.delete,FileAsset,asset-3',
    );
  });

  it('exportCsv resolves actor columns and RFC-4180-escapes commas/quotes', async () => {
    repo.findMany.mockResolvedValue([row({ action: 'item.update' })]);
    repo.findActorsByIds.mockResolvedValue([
      {
        id: 'admin-1',
        username: 'Doe, Jane',
        email: 'jane@acme.test',
        roles: [{ role: 'SUPER_ADMIN' }, { role: 'ADMIN' }],
      },
    ]);

    const csv = await svc.exportCsv({ order: 'desc' } as any);
    const line = csv.split('\r\n')[1];

    expect(line).toBe(
      '2026-07-09T10:00:00.000Z,"Doe, Jane",jane@acme.test,SUPER_ADMIN ADMIN,item.update,User,user-9',
    );
  });

  it('caps the CSV at EXPORT_CAP rows and warns only when more exist', async () => {
    const many = Array.from({ length: 5001 }, (_, i) =>
      row({ id: `e${i}`, actorId: null }),
    );
    repo.findMany.mockResolvedValue(many);
    const warn = jest
      .spyOn((svc as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const csv = await svc.exportCsv({ order: 'desc' } as any);

    expect(csv.split('\r\n')).toHaveLength(5001); // 1 header + 5000 data rows (5001st dropped)
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('does not warn when the CSV result is within the cap', async () => {
    repo.findMany.mockResolvedValue([row({ actorId: null })]);
    const warn = jest
      .spyOn((svc as any).logger, 'warn')
      .mockImplementation(() => undefined);

    await svc.exportCsv({ order: 'desc' } as any);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('RFC-4180-escapes quotes and newlines in a CSV field', async () => {
    repo.findMany.mockResolvedValue([
      row({ actorId: null, entity: 'Note "A"', entityId: 'x\ny' }),
    ]);

    const line = (await svc.exportCsv({ order: 'desc' } as any)).split(
      '\r\n',
    )[1];

    expect(line).toContain('"Note ""A"""');
    expect(line).toContain('"x\ny"');
  });

  it('exportCsv shows "Unknown user" for a present-but-deleted actor', async () => {
    repo.findMany.mockResolvedValue([row({ actorId: 'ghost' })]);
    repo.findActorsByIds.mockResolvedValue([]); // user no longer exists

    const line = (await svc.exportCsv({ order: 'desc' } as any)).split(
      '\r\n',
    )[1];

    expect(line.split(',')[1]).toBe('Unknown user');
  });
});
