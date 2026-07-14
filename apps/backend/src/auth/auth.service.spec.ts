import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const makeUsers = () =>
  ({
    findByEmail: jest.fn(),
    findById: jest.fn(async () => ({
      id: 'u1',
      email: 'jan@x.com',
      username: 'Jan',
    })),
    updateUser: jest.fn(async () => undefined),
    createPasswordResetToken: jest.fn(async () => undefined),
    findPasswordResetByHash: jest.fn(),
    consumeResetTokensForUser: jest.fn(async () => undefined),
    revokeAllAuthSessionsForUser: jest.fn(async () => undefined),
    validateUserPassword: jest.fn(),
    recordFailedLogin: jest.fn(async () => undefined),
    clearFailedLogins: jest.fn(async () => undefined),
    createAuthSession: jest.fn(async () => undefined),
  }) as any;
const makeMail = () =>
  ({
    sendPasswordReset: jest.fn(async () => undefined),
    sendPasswordChanged: jest.fn(async () => undefined),
  }) as any;
const makeConfig = () => ({ get: jest.fn(() => 'https://web.test') }) as any;
const makeJwt = () => ({ sign: jest.fn(() => 'signed.jwt.token') }) as any;

const build = (users: any, mail: any) =>
  new AuthService(users, makeJwt(), makeConfig(), mail);

describe('AuthService password reset', () => {
  let users: any, mail: any;
  beforeEach(() => {
    users = makeUsers();
    mail = makeMail();
  });

  it('requestPasswordReset sends a link when the user has a password', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'jan@x.com',
      username: 'Jan',
      password: 'hash',
    });
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
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'g@x.com',
      username: 'G',
      password: null,
    });
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

    expect(users.updateUser).toHaveBeenCalledWith('u1', {
      password: 'newpass12',
    });
    expect(users.consumeResetTokensForUser).toHaveBeenCalledWith('u1');
    expect(users.revokeAllAuthSessionsForUser).toHaveBeenCalledWith('u1');
    expect(mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/updated/i);
  });

  it('resetPassword rejects an expired token', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
    });
    const svc = build(users, mail);
    await expect(svc.resetPassword('RAW', 'newpass12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it('resetPassword rejects an unknown or consumed token', async () => {
    users.findPasswordResetByHash.mockResolvedValue(null);
    const svc = build(users, mail);
    await expect(svc.resetPassword('NOPE', 'newpass12')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('requestPasswordReset still returns the generic message when the email fails (no enumeration oracle)', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'jan@x.com',
      username: 'Jan',
      password: 'hash',
    });
    mail.sendPasswordReset.mockRejectedValue(new Error('brevo down'));
    const svc = build(users, mail);

    const res = await svc.requestPasswordReset('jan@x.com');
    expect(res.message).toMatch(/if an account/i);
    expect(users.createPasswordResetToken).toHaveBeenCalledTimes(1);
  });

  it('resetPassword still succeeds when the confirmation email fails', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    mail.sendPasswordChanged.mockRejectedValue(new Error('brevo down'));
    const svc = build(users, mail);

    const res = await svc.resetPassword('RAW', 'newpass12');
    expect(res.message).toMatch(/updated/i);
    expect(users.updateUser).toHaveBeenCalledWith('u1', {
      password: 'newpass12',
    });
  });

  it('resetPassword lifts an account lockout — the mailbox proves more than the failure count', async () => {
    users.findPasswordResetByHash.mockResolvedValue({
      id: 't1',
      userId: 'u1',
      tokenHash: sha256('RAW'),
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    const svc = build(users, mail);

    await svc.resetPassword('RAW', 'newpass12');

    expect(users.clearFailedLogins).toHaveBeenCalledWith('u1');
  });
});

describe('AuthService login lockout', () => {
  let users: any, mail: any;
  beforeEach(() => {
    users = makeUsers();
    mail = makeMail();
  });

  const account = (over: Record<string, unknown> = {}) => ({
    id: 'u1',
    email: 'jan@x.com',
    username: 'Jan',
    password: 'hash',
    roles: [],
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...over,
  });

  it('counts a failed attempt against the account', async () => {
    users.findByEmail.mockResolvedValue(account());
    users.validateUserPassword.mockResolvedValue(null);
    const svc = build(users, mail);

    await expect(
      svc.login({ email: 'jan@x.com', password: 'wrong' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.recordFailedLogin).toHaveBeenCalledWith(
      'u1',
      10,
      15 * 60 * 1000,
    );
  });

  it('refuses a locked account before it even checks the password', async () => {
    users.findByEmail.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() + 5 * 60_000) }),
    );
    const svc = build(users, mail);

    await expect(
      svc.login({ email: 'jan@x.com', password: 'hunter2' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    // The point of the lockout: a locked account costs the attacker a bcrypt
    // comparison of zero passwords, however many requests they send.
    expect(users.validateUserPassword).not.toHaveBeenCalled();
  });

  it('lets the account back in once the lock has expired', async () => {
    users.findByEmail.mockResolvedValue(
      account({ lockedUntil: new Date(Date.now() - 1000) }),
    );
    users.validateUserPassword.mockResolvedValue(account());
    const svc = build(users, mail);

    const res = await svc.login({
      email: 'jan@x.com',
      password: 'right',
    } as any);

    expect(res.access_token).toBe('signed.jwt.token');
  });

  it('resets the counter on a successful login, so failures have to be consecutive', async () => {
    users.findByEmail.mockResolvedValue(account({ failedLoginAttempts: 7 }));
    users.validateUserPassword.mockResolvedValue(
      account({ failedLoginAttempts: 7 }),
    );
    const svc = build(users, mail);

    await svc.login({ email: 'jan@x.com', password: 'right' } as any);

    expect(users.clearFailedLogins).toHaveBeenCalledWith('u1');
    expect(users.recordFailedLogin).not.toHaveBeenCalled();
  });

  it('does not try to count a failure for an address that has no account', async () => {
    users.findByEmail.mockResolvedValue(null);
    users.validateUserPassword.mockResolvedValue(null);
    const svc = build(users, mail);

    await expect(
      svc.login({ email: 'nobody@x.com', password: 'x' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.recordFailedLogin).not.toHaveBeenCalled();
  });
});

describe('AuthService changePassword', () => {
  let users: any, mail: any;
  beforeEach(() => {
    users = makeUsers();
    mail = makeMail();
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'jan@x.com',
      username: 'Jan',
      password: 'hash',
    });
  });

  it('updates the password and revokes every session', async () => {
    users.validateUserPassword.mockResolvedValue({ id: 'u1' });
    const svc = build(users, mail);

    const res = await svc.changePassword('u1', 'OldPass123!', 'NewPass123!');

    expect(users.updateUser).toHaveBeenCalledWith('u1', {
      password: 'NewPass123!',
    });
    // You change your password because someone else might hold a session.
    expect(users.revokeAllAuthSessionsForUser).toHaveBeenCalledWith('u1');
    expect(mail.sendPasswordChanged).toHaveBeenCalledTimes(1);
    expect(res.message).toMatch(/updated/i);
  });

  it('rejects a wrong current password', async () => {
    users.validateUserPassword.mockResolvedValue(null);
    const svc = build(users, mail);

    await expect(
      svc.changePassword('u1', 'wrong', 'NewPass123!'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    users.validateUserPassword.mockResolvedValue({ id: 'u1' });
    const svc = build(users, mail);

    await expect(
      svc.changePassword('u1', 'SamePass1!', 'SamePass1!'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(users.updateUser).not.toHaveBeenCalled();
  });

  it('tells a provider-only account to use the reset flow instead', async () => {
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'g@x.com',
      username: 'G',
      password: null,
    });
    const svc = build(users, mail);

    await expect(
      svc.changePassword('u1', 'x', 'NewPass123!'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still succeeds when the confirmation email fails', async () => {
    users.validateUserPassword.mockResolvedValue({ id: 'u1' });
    mail.sendPasswordChanged.mockRejectedValue(new Error('brevo down'));
    const svc = build(users, mail);

    const res = await svc.changePassword('u1', 'OldPass123!', 'NewPass123!');
    expect(res.message).toMatch(/updated/i);
  });
});
