import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { StaffService } from './staff.service';
import { Role } from '../types/role.enum';

const user = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  email: 'jan@x.com',
  username: 'Jan',
  createdAt: new Date('2026-01-01'),
  roles: [{ role: Role.EDITOR }],
  ...over,
});

const makeRepo = () =>
  ({
    create: jest.fn(async () => user()),
    findById: jest.fn(async () => user()),
    findManyStaff: jest.fn(async () => [user()]),
    countStaff: jest.fn(async () => 1),
    replaceRoles: jest.fn(async () => user({ roles: [{ role: Role.ADMIN }] })),
    deactivate: jest.fn(async () => undefined),
    existsByEmail: jest.fn(async () => false),
    countHoldersOfRole: jest.fn(async () => 2),
  }) as any;

const makeAudit = () => ({ record: jest.fn(async () => undefined) }) as any;

describe('StaffService', () => {
  let repo: any, audit: any, svc: StaffService;
  beforeEach(() => {
    repo = makeRepo();
    audit = makeAudit();
    svc = new StaffService(repo, audit);
  });

  describe('create', () => {
    it('hashes the password — it is never stored as given', async () => {
      await svc.create(
        {
          email: 'New@X.com',
          username: ' Jan ',
          password: 'hunter22',
          roles: [Role.EDITOR],
        },
        'actor1',
      );

      const written = repo.create.mock.calls[0][0];
      expect(written.password).not.toBe('hunter22');
      expect(written.password).toMatch(/^\$2[aby]\$/);
    });

    it('normalises the email and username', async () => {
      await svc.create(
        {
          email: '  New@X.com ',
          username: ' Jan ',
          password: 'hunter22',
          roles: [Role.EDITOR],
        },
        'actor1',
      );

      const written = repo.create.mock.calls[0][0];
      expect(written.email).toBe('new@x.com');
      expect(written.username).toBe('Jan');
    });

    it('rejects a duplicate email', async () => {
      repo.existsByEmail.mockResolvedValue(true);

      await expect(
        svc.create(
          {
            email: 'jan@x.com',
            username: 'Jan',
            password: 'hunter22',
            roles: [Role.EDITOR],
          },
          'actor1',
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('records who created the account', async () => {
      await svc.create(
        {
          email: 'new@x.com',
          username: 'Jan',
          password: 'hunter22',
          roles: [Role.EDITOR],
        },
        'actor1',
      );

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor1',
          action: 'staff.create',
          entity: 'User',
        }),
      );
    });
  });

  describe('findOne', () => {
    it('404s on an unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.findOne('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('replaceRoles', () => {
    it('replaces the roles and records the change', async () => {
      const res = await svc.replaceRoles('u1', [Role.ADMIN], 'actor1');

      expect(repo.replaceRoles).toHaveBeenCalledWith('u1', [Role.ADMIN]);
      expect(res.roles).toEqual([Role.ADMIN]);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'staff.roles.replace',
          meta: { roles: [Role.ADMIN] },
        }),
      );
    });

    // Demoting the last SUPER_ADMIN cannot be undone from inside the product:
    // no account left can grant the role back.
    it('refuses to demote the last SUPER_ADMIN', async () => {
      repo.findById.mockResolvedValue(
        user({ roles: [{ role: Role.SUPER_ADMIN }] }),
      );
      repo.countHoldersOfRole.mockResolvedValue(1);

      await expect(
        svc.replaceRoles('u1', [Role.ADMIN], 'actor1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.replaceRoles).not.toHaveBeenCalled();
    });

    it('allows demoting a SUPER_ADMIN while another one remains', async () => {
      repo.findById.mockResolvedValue(
        user({ roles: [{ role: Role.SUPER_ADMIN }] }),
      );
      repo.countHoldersOfRole.mockResolvedValue(2);

      await svc.replaceRoles('u1', [Role.ADMIN], 'actor1');

      expect(repo.replaceRoles).toHaveBeenCalledWith('u1', [Role.ADMIN]);
    });

    it('allows a SUPER_ADMIN to keep the role while other roles change', async () => {
      repo.findById.mockResolvedValue(
        user({ roles: [{ role: Role.SUPER_ADMIN }] }),
      );
      repo.countHoldersOfRole.mockResolvedValue(1);

      await svc.replaceRoles('u1', [Role.SUPER_ADMIN, Role.EDITOR], 'actor1');

      expect(repo.replaceRoles).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('revokes access and records it', async () => {
      await svc.deactivate('u1', 'actor1');

      expect(repo.deactivate).toHaveBeenCalledWith('u1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'staff.deactivate', entityId: 'u1' }),
      );
    });

    // Revoking your own access signs you out of the console you would need to undo it.
    it('refuses to let an actor revoke their own access', async () => {
      await expect(svc.deactivate('actor1', 'actor1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.deactivate).not.toHaveBeenCalled();
    });

    it('refuses to revoke the last SUPER_ADMIN', async () => {
      repo.findById.mockResolvedValue(
        user({ roles: [{ role: Role.SUPER_ADMIN }] }),
      );
      repo.countHoldersOfRole.mockResolvedValue(1);

      await expect(svc.deactivate('u1', 'actor1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.deactivate).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('paginates', async () => {
      repo.countStaff.mockResolvedValue(42);

      const res = await svc.list({ page: 2, limit: 20 } as any);

      expect(repo.findManyStaff).toHaveBeenCalledWith(
        { search: undefined, role: undefined },
        20,
        20,
      );
      expect(res.meta).toEqual({
        total: 42,
        page: 2,
        limit: 20,
        totalPages: 3,
      });
    });

    it('trims the search term before it reaches the query', async () => {
      await svc.list({ search: '  jan  ', role: Role.EDITOR } as any);

      expect(repo.findManyStaff).toHaveBeenCalledWith(
        { search: 'jan', role: Role.EDITOR },
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
