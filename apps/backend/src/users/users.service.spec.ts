import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { UsersService } from './users.service';

const makeRepo = () =>
  ({
    createPasswordResetToken: jest.fn(async () => ({ id: 't1' })),
    findPasswordResetByHash: jest.fn(async () => ({ id: 't1', userId: 'u1' })),
    consumeResetTokensForUser: jest.fn(async () => undefined),
    revokeAllAuthSessionsForUser: jest.fn(async () => undefined),
  }) as any;

describe('UsersService password-reset delegations', () => {
  let repo: any;
  let service: UsersService;

  beforeEach(() => {
    repo = makeRepo();
    service = new UsersService(repo);
  });

  it('createPasswordResetToken delegates to the repository', async () => {
    const input = { userId: 'u1', tokenHash: 'h', expiresAt: new Date() };
    await service.createPasswordResetToken(input);
    expect(repo.createPasswordResetToken).toHaveBeenCalledWith(input);
  });

  it('findPasswordResetByHash delegates and returns the record', async () => {
    const rec = await service.findPasswordResetByHash('h');
    expect(repo.findPasswordResetByHash).toHaveBeenCalledWith('h');
    expect(rec).toEqual({ id: 't1', userId: 'u1' });
  });

  it('consumeResetTokensForUser and revokeAllAuthSessionsForUser delegate', async () => {
    await service.consumeResetTokensForUser('u1');
    await service.revokeAllAuthSessionsForUser('u1');
    expect(repo.consumeResetTokensForUser).toHaveBeenCalledWith('u1');
    expect(repo.revokeAllAuthSessionsForUser).toHaveBeenCalledWith('u1');
  });
});
