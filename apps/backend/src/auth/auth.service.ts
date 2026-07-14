import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginDto } from './dto/login.dto';
import {
  UserWithRoles,
  UserWithRolesAndAccounts,
} from '../users/users.repository';
import { Role } from '../types/role.enum';
import { SocialAuthProfile } from '../users/users.service';
import { ExchangeAuthDto } from './dto/exchange-auth.dto';

interface AuthTokenPayload {
  sub: string;
  email: string;
  username: string;
  avatar?: string;
  roles: Role[];
}

/**
 * What the API is willing to say about a user.
 *
 * Spelled out rather than derived as `Omit<User, 'password'>`: a subtractive type
 * leaks every column added to the model later, which is exactly how the lockout
 * bookkeeping (failedLoginAttempts, lockedUntil) would have reached the client.
 * Adding a field here has to be a decision.
 */
export interface PublicUser {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Whether this account has a password at all. A provider-only account (signed
   * up through Google) has none, and the frontend needs to know that to avoid
   * offering a "change password" form that can only ever fail.
   *
   * The boolean, never the hash.
   */
  hasPassword: boolean;
}

export interface AuthUserResponse extends PublicUser {
  roles: UserRole[];
}

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
}

export interface AuthTokensResponse {
  user: AuthUserResponse;
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  private readonly logger = new Logger(AuthService.name);
  private readonly resetTokenTtlMins = 30;

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const genericMessage =
      'If an account exists for that email, a password reset link is on its way.';
    const user = await this.usersService.findByEmail(email);

    if (user && user.password) {
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = this.hashResetToken(rawToken);
      const expiresAt = new Date(
        Date.now() + this.resetTokenTtlMins * 60 * 1000,
      );

      await this.usersService.createPasswordResetToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const baseUrl = this.configService.get<string>('APP_WEB_URL') ?? '';
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      try {
        await this.mailService.sendPasswordReset(user.email, {
          name: user.username,
          resetUrl,
          ttlMins: this.resetTokenTtlMins,
        });
      } catch (err) {
        this.logger.error(
          `Failed to send password-reset email to ${user.id}`,
          err as Error,
        );
      }
    }

    return { message: genericMessage };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const record = await this.usersService.findPasswordResetByHash(
      this.hashResetToken(token),
    );

    if (!record || record.consumedAt || record.expiresAt <= new Date()) {
      throw new BadRequestException(
        'This reset link is invalid or has expired',
      );
    }

    await this.usersService.updateUser(record.userId, {
      password: newPassword,
    });
    await this.usersService.consumeResetTokensForUser(record.userId);
    await this.usersService.revokeAllAuthSessionsForUser(record.userId);
    // Proving control of the mailbox is a stronger signal than the failure count
    // that locked the account, so a completed reset lifts the lock.
    await this.usersService.clearFailedLogins(record.userId);

    const user = await this.usersService.findById(record.userId);
    try {
      await this.mailService.sendPasswordChanged(user.email, {
        name: user.username,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password-changed email to ${user.id}`,
        err as Error,
      );
    }

    return { message: 'Your password has been updated.' };
  }

  private hashResetToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(createUserDto: CreateUserDto): Promise<AuthTokensResponse> {
    const user = await this.usersService.createUser(createUserDto);

    return this.issueAuthTokens(user);
  }

  /**
   * Consecutive failures before the account is locked, and for how long.
   *
   * This is the defence that survives an attacker rotating IPs, which is exactly
   * what defeats the per-(IP, email) rate limit on this route. Ten guesses per
   * fifteen minutes is a hard ceiling no amount of infrastructure raises.
   *
   * The cost is that anyone who knows an address can keep it locked. That is the
   * accepted trade in every lockout scheme; the window is short on purpose, and
   * a password reset clears the lock immediately.
   */
  private static readonly MAX_FAILED_LOGINS = 10;
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;

  async login(loginDto: LoginDto): Promise<AuthTokensResponse> {
    const existing = await this.usersService.findByEmail(loginDto.email);

    if (existing?.lockedUntil && existing.lockedUntil > new Date()) {
      const minutes = Math.max(
        1,
        Math.ceil((existing.lockedUntil.getTime() - Date.now()) / 60_000),
      );
      throw new ForbiddenException(
        `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      );
    }

    const user = await this.usersService.validateUserPassword(
      loginDto.email,
      loginDto.password,
    );

    if (!user) {
      // Only a known user can be counted — there is no row to count against
      // otherwise. Unknown addresses are still bounded by LoginThrottlerGuard.
      if (existing) {
        await this.usersService.recordFailedLogin(
          existing.id,
          AuthService.MAX_FAILED_LOGINS,
          AuthService.LOCKOUT_MS,
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.clearFailedLogins(user.id);

    return this.issueAuthTokens(user);
  }

  /**
   * Changing a password revokes every other session, on the assumption that the
   * reason you are changing it is that someone else may hold one.
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);

    if (!user.password) {
      throw new BadRequestException(
        'This account signs in with a provider and has no password to change. Use "forgot password" to set one.',
      );
    }

    const valid = await this.usersService.validateUserPassword(
      user.email,
      currentPassword,
    );
    if (!valid) {
      throw new UnauthorizedException('Your current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        'The new password must differ from the current one',
      );
    }

    await this.usersService.updateUser(userId, { password: newPassword });
    await this.usersService.revokeAllAuthSessionsForUser(userId);

    try {
      await this.mailService.sendPasswordChanged(user.email, {
        name: user.username,
      });
    } catch (err) {
      this.logger.error(
        `Failed to send password-changed email to ${user.id}`,
        err as Error,
      );
    }

    return { message: 'Your password has been updated.' };
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.usersService.findOne({ id: userId });
    return this.buildProfileResponse(user);
  }

  async exchangeIdentity(input: ExchangeAuthDto): Promise<AuthTokensResponse> {
    const user = await this.usersService.findOrCreateSocialUser(
      this.mapExternalProfile(input),
    );

    return this.issueAuthTokens(user);
  }

  async linkProvider(
    userId: string,
    input: ExchangeAuthDto,
  ): Promise<AuthUserResponse> {
    const user = await this.usersService.linkProviderAccountToUser(
      userId,
      this.mapExternalProfile(input),
    );

    return this.buildAuthUserResponse(user);
  }

  async unlinkProvider(
    userId: string,
    provider: string,
    providerAccountId: string,
  ): Promise<AuthUserResponse> {
    const user = await this.usersService.unlinkProviderAccountFromUser(
      userId,
      provider,
      providerAccountId,
    );

    return this.buildAuthUserResponse(user);
  }

  async refreshSession(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<AuthTokensResponse> {
    const payload = await this.verifyRefreshToken(refreshTokenDto.refreshToken);
    const refreshTokenHash = this.hashRefreshToken(
      refreshTokenDto.refreshToken,
    );
    const session =
      await this.usersService.findAuthSessionByHash(refreshTokenHash);

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (session.id !== payload.sid || session.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    await this.usersService.touchAuthSession(session.id);
    await this.usersService.revokeAuthSession(session.id);

    const user = await this.usersService.findById(payload.sub);

    return this.issueAuthTokens(user);
  }

  async revokeSession(
    refreshTokenDto: RefreshTokenDto,
  ): Promise<{ revoked: true }> {
    const refreshTokenHash = this.hashRefreshToken(
      refreshTokenDto.refreshToken,
    );
    const session =
      await this.usersService.findAuthSessionByHash(refreshTokenHash);

    if (session && !session.revokedAt) {
      await this.usersService.revokeAuthSession(session.id);
    }

    return { revoked: true };
  }

  async listSessions(userId: string): Promise<
    {
      id: string;
      expiresAt: Date;
      lastUsedAt: Date | null;
      createdAt: Date;
      revokedAt: Date | null;
    }[]
  > {
    const sessions =
      await this.usersService.listActiveAuthSessionsForUser(userId);

    return sessions.map((session) => ({
      id: session.id,
      expiresAt: session.expiresAt,
      lastUsedAt: session.lastUsedAt,
      createdAt: session.createdAt,
      revokedAt: session.revokedAt,
    }));
  }

  async revokeSessionById(
    userId: string,
    sessionId: string,
  ): Promise<{ revoked: true }> {
    await this.usersService.revokeAuthSessionForUser(userId, sessionId);
    return { revoked: true };
  }

  async listLinkedProviders(userId: string): Promise<
    {
      id: string;
      provider: string;
      providerAccountId: string;
      createdAt: Date;
    }[]
  > {
    const user = await this.usersService.findById(userId);
    const withAccounts = await this.usersService.findByEmailWithAccounts(
      user.email,
    );

    if (!withAccounts) {
      throw new NotFoundException('User not found');
    }

    return withAccounts.accounts.map((account) => ({
      id: account.id,
      provider: account.provider,
      providerAccountId: account.providerAccountId,
      createdAt: account.createdAt,
    }));
  }

  private buildTokenPayload(
    user: UserWithRoles | UserWithRolesAndAccounts,
  ): AuthTokenPayload {
    return {
      sub: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar ?? undefined,
      roles: user.roles?.map((role) => role.role as Role) ?? [],
    };
  }

  private buildAuthUserResponse(
    user: UserWithRoles | UserWithRolesAndAccounts,
  ): AuthUserResponse {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasPassword: Boolean(user.password),
      roles: user.roles,
    };
  }

  private buildProfileResponse(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      avatar: user.avatar,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      hasPassword: Boolean(user.password),
    };
  }

  private async issueAuthTokens(
    user: UserWithRoles | UserWithRolesAndAccounts,
  ): Promise<AuthTokensResponse> {
    const sessionId = randomUUID();
    const accessToken = this.jwtService.sign(this.buildTokenPayload(user), {
      expiresIn: this.getAccessTokenTtlSeconds(),
    });
    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        sid: sessionId,
        type: 'refresh',
      } satisfies RefreshTokenPayload,
      {
        expiresIn: this.getRefreshTokenTtlSeconds(),
      },
    );

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.getRefreshTokenTtlSeconds() * 1000,
    );

    await this.usersService.createAuthSession({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return {
      user: this.buildAuthUserResponse(user),
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async verifyRefreshToken(
    refreshToken: string,
  ): Promise<RefreshTokenPayload> {
    const payload =
      await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    return payload;
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getAccessTokenTtlSeconds(): number {
    return this.parseDurationToSeconds(
      this.configService.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
    );
  }

  private getRefreshTokenTtlSeconds(): number {
    return this.parseDurationToSeconds(
      this.configService.get<string>('REFRESH_TOKEN_TTL') ?? '30d',
    );
  }

  private parseDurationToSeconds(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);

    if (!match) {
      return 30 * 24 * 60 * 60;
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };

    return amount * multipliers[unit];
  }

  private mapExternalProfile(input: ExchangeAuthDto): SocialAuthProfile {
    return {
      email: input.email,
      username: input.username,
      avatar: input.avatar,
      emailVerifiedAt: new Date(input.emailVerifiedAt),
      providerAccount: {
        provider: input.provider,
        providerAccountId: input.providerAccountId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        idToken: input.idToken,
        tokenType: input.tokenType,
        scope: input.scope,
        expiresAt: input.expiresAt,
      },
    };
  }
}
