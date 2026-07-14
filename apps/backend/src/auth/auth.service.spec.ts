import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const makeUsers = () =>
  ({
    findByEmail: jest.fn(),
    findById: jest.fn(async () => ({ id: 'u1', email: 'jan@x.com', username: 'Jan' })),
    updateUser: jest.fn(async () => undefined),
    createPasswordResetToken: jest.fn(async () => undefined),
    findPasswordResetByHash: jest.fn(),
    consumeResetTokensForUser: jest.fn(async () => undefined),
    revokeAllAuthSessionsForUser: jest.fn(async () => undefined),
  }) as any;
const makeMail = () =>
  ({ sendPasswordReset: jest.fn(async () => undefined), sendPasswordChanged: jest.fn(async () => undefined) }) as any;
const makeConfig = () => ({ get: jest.fn(() => 'https://web.test') }) as any;

const build = (users: any, mail: any) =>
  new AuthService(users, {} as any, makeConfig(), mail);

describe('AuthService password reset', () => {
  let users: any, mail: any;
  beforeEach(() => {
    users = makeUsers();
    mail = makeMail();
  });

  it('requestPasswordReset sends a link when the user has a password', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'jan@x.com', username: 'Jan', password: 'hash' });
    const svc = build(users, mail);

    const res = await svc.requestPasswordReset('jan@x.com');

    expect(users.createPasswordResetToken).toHaveBeenCalledTimes(1);
    expect(mail.sendPasswordReset).toHaveBeenCalledTimes(1);
    const to = mail.sendPasswordReset.mock.calls[0][0];
    const data = mail.sendPasswordReset.mock.calls[0][1];
    expect(to).toBe('jan@x.com');
    expect(data.resetUrl).toContain('https://web.test/reset-password?token=');
    expect(res.message).toMatch(/if an account/i);
  });

  it('requestPasswordReset is silent for an unknown email (non-enumeration)', async () => {
    users.findByEmail.mockResolvedValue(null);
    const svc = build(users, mail);

    const res = await svc.requestPasswordReset('nobody@x.com');

    expect(users.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    expect(res.message).toMatch(/if an account/i);
  });

  it('requestPasswordReset is silent for a Google-only account (no password)', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'g@x.com', username: 'G', password: null });
    const svc = build(users, mail);

    await svc.requestPasswordReset('g@x.com');

    expect(users.createPasswordResetToken).not.toHaveBeenCalled();
    expect(mail.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('resetPassword updates the password, revokes sessions and confirms by email', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    const svc = build(users, mail);

    const res = await svc.resetPassword('RAW', 'newpass12');

    expect(users.updateUser).toHaveBeenCalledWith('u1', { password: 'newpass12' });
    expect(users.consumeResetTokensForUser).toHaveBeenCalledWith('u1');
    expect(users.revokeAllAuthSessionsForUser).toHaveBeenCalledWith('u1');
    expect(mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/updated/i);
  });

  it('resetPassword rejects an expired token', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() - 1000), consumedAt: null,
    });
    const svc = build(users, mail);
    await expect(svc.resetPassword('RAW', 'newpass12')).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it('resetPassword rejects an unknown or consumed token', async () => {
    users.findPasswordResetByHash.mockResolvedValue(null);
    const svc = build(users, mail);
    await expect(svc.resetPassword('NOPE', 'newpass12')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requestPasswordReset still returns the generic message when the email fails (no enumeration oracle)', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'jan@x.com', username: 'Jan', password: 'hash' });
    mail.sendPasswordReset.mockRejectedValue(new Error('brevo down'));
    const svc = build(users, mail);

    const res = await svc.requestPasswordReset('jan@x.com');
    expect(res.message).toMatch(/if an account/i);
    expect(users.createPasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it('resetPassword still succeeds when the confirmation email fails', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1', userId: 'u1', tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    });
    mail.sendPasswordChanged.mockRejectedValue(new Error('brevo down'));
    const svc = build(users, mail);

    const res = await svc.resetPassword('RAW', 'newpass12');
    expect(res.message).toMatch(/updated/i);
    expect(users.updateUser).toHaveBeenCalledWith('u1', { password: 'newpass12' });
  });
});
