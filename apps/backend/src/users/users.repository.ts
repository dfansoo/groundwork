import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Account,
  AuthSession,
  PasswordResetToken,
  User,
  Role,
  UserRole,
  Prisma,
} from '@prisma/client';
import { CreateUserDto } from './dto/create-user.dto';
import { CryptoService } from '../common/crypto/crypto.service';

export type UserWithRoles = User & { roles: UserRole[] };
export type UserWithRolesAndAccounts = User & {
  roles: UserRole[];
  accounts: Account[];
};

export interface ProviderAccountInput {
  provider: string;
  providerAccountId: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  tokenType?: string;
  scope?: string;
  expiresAt?: number;
}

export interface AuthSessionInput {
  id?: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface PasswordResetTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  private encryptProviderAccount(
    input: ProviderAccountInput,
  ): ProviderAccountInput {
    return {
      ...input,
      accessToken: this.crypto.encryptNullable(input.accessToken) ?? undefined,
      refreshToken: this.crypto.encryptNullable(input.refreshToken) ?? undefined,
      idToken: this.crypto.encryptNullable(input.idToken) ?? undefined,
    };
  }

  private decryptAccount<T extends Account>(account: T): T {
    return {
      ...account,
      accessToken: this.crypto.decryptNullable(account.accessToken),
      refreshToken: this.crypto.decryptNullable(account.refreshToken),
      idToken: this.crypto.decryptNullable(account.idToken),
    };
  }

  private decryptUserAccounts(
    user: UserWithRolesAndAccounts,
  ): UserWithRolesAndAccounts {
    return { ...user, accounts: user.accounts.map((a) => this.decryptAccount(a)) };
  }

  async create(
    userData: CreateUserDto & { password: string },
  ): Promise<UserWithRoles> {
    return this.prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        avatar: userData.avatar,
        password: userData.password,
        roles: {
          create: [
            {
              role: Role.USER,
            },
          ],
        },
      },
      include: {
        roles: true,
      },
    });
  }

  async createWithProviderAccount(
    userData: Omit<CreateUserDto, 'password'> & {
      emailVerifiedAt?: Date;
      providerAccount: ProviderAccountInput;
    },
  ): Promise<UserWithRolesAndAccounts> {
    const acct = this.encryptProviderAccount(userData.providerAccount);
    const result = await this.prisma.user.create({
      data: {
        email: userData.email,
        username: userData.username,
        avatar: userData.avatar,
        emailVerifiedAt: userData.emailVerifiedAt,
        accounts: {
          create: {
            provider: acct.provider,
            providerAccountId: acct.providerAccountId,
            accessToken: acct.accessToken,
            refreshToken: acct.refreshToken,
            idToken: acct.idToken,
            tokenType: acct.tokenType,
            scope: acct.scope,
            expiresAt: acct.expiresAt,
          },
        },
        roles: {
          create: [
            {
              role: Role.USER,
            },
          ],
        },
      },
      include: {
        roles: true,
        accounts: true,
      },
    });
    return this.decryptUserAccounts(result);
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
      },
    });
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: true,
      },
    });
  }

  async findByEmailWithAccounts(
    email: string,
  ): Promise<UserWithRolesAndAccounts | null> {
    const result = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: true,
        accounts: true,
      },
    });
    return result ? this.decryptUserAccounts(result) : null;
  }

  async findByProviderAccount(
    provider: string,
    providerAccountId: string,
  ): Promise<UserWithRolesAndAccounts | null> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: {
          include: {
            roles: true,
            accounts: true,
          },
        },
      },
    });

    if (!account?.user) return null;
    return this.decryptUserAccounts(account.user);
  }

  async findOne(filter: Prisma.UserWhereInput): Promise<UserWithRoles | null> {
    return this.prisma.user.findFirst({
      where: filter,
      include: {
        roles: true,
      },
    });
  }

  async update(id: string, data: Partial<User>): Promise<UserWithRoles> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: {
        roles: true,
      },
    });
  }

  async delete(id: string): Promise<UserWithRoles> {
    return this.prisma.user.delete({
      where: { id },
      include: {
        roles: true,
      },
    });
  }

  async findMany(skip?: number, take?: number): Promise<UserWithRoles[]> {
    return this.prisma.user.findMany({
      skip,
      take,
      include: {
        roles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  async existsByEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!user;
  }

  async linkProviderAccount(
    userId: string,
    providerAccount: ProviderAccountInput,
  ): Promise<UserWithRolesAndAccounts> {
    const acct = this.encryptProviderAccount(providerAccount);
    const result = await this.prisma.user.update({
      where: { id: userId },
      data: {
        accounts: {
          create: {
            provider: acct.provider,
            providerAccountId: acct.providerAccountId,
            accessToken: acct.accessToken,
            refreshToken: acct.refreshToken,
            idToken: acct.idToken,
            tokenType: acct.tokenType,
            scope: acct.scope,
            expiresAt: acct.expiresAt,
          },
        },
      },
      include: {
        roles: true,
        accounts: true,
      },
    });
    return this.decryptUserAccounts(result);
  }

  async findProviderAccountRecord(
    provider: string,
    providerAccountId: string,
  ): Promise<Account | null> {
    const account = await this.prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });
    return account ? this.decryptAccount(account) : null;
  }

  async unlinkProviderAccount(
    userId: string,
    provider: string,
    providerAccountId: string,
  ): Promise<UserWithRolesAndAccounts> {
    await this.prisma.account.delete({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
    });

    const result = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: true,
        accounts: true,
      },
    });
    return this.decryptUserAccounts(result);
  }

  async countProviderAccountsForUser(userId: string): Promise<number> {
    return this.prisma.account.count({
      where: { userId },
    });
  }

  async createAuthSession(input: AuthSessionInput): Promise<AuthSession> {
    return this.prisma.authSession.create({
      data: input,
    });
  }

  async createPasswordResetToken(
    input: PasswordResetTokenInput,
  ): Promise<PasswordResetToken> {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  async findPasswordResetByHash(
    tokenHash: string,
  ): Promise<PasswordResetToken | null> {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async consumeResetTokensForUser(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
  }

  async revokeAllAuthSessionsForUser(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findAuthSessionByHash(
    refreshTokenHash: string,
  ): Promise<AuthSession | null> {
    return this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
    });
  }

  async revokeAuthSession(sessionId: string): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async touchAuthSession(sessionId: string): Promise<AuthSession> {
    return this.prisma.authSession.update({
      where: { id: sessionId },
      data: {
        lastUsedAt: new Date(),
      },
    });
  }

  async listActiveAuthSessionsForUser(userId: string): Promise<AuthSession[]> {
    return this.prisma.authSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findAuthSessionById(sessionId: string): Promise<AuthSession | null> {
    return this.prisma.authSession.findUnique({
      where: { id: sessionId },
    });
  }
}
