import { Module } from '@nestjs/common';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import * as fs from 'fs';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ExchangeSecretGuard } from './exchange-secret.guard';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const privateKeyPath = configService.get<string>(
          'JWT_PRIVATE_KEY_PATH',
        );
        const publicKeyPath = configService.get<string>('JWT_PUBLIC_KEY_PATH');
        const privateKey = fs.readFileSync(privateKeyPath);
        const publicKey = fs.readFileSync(publicKeyPath);

        return {
          privateKey,
          publicKey,
          // ES256 → the keypair must be EC P-256. `bun run keys:generate` makes one.
          // The cast is needed because ms's StringValue template type rejects a
          // plain `string` read from config.
          signOptions: {
            expiresIn: configService.get<string>('ACCESS_TOKEN_TTL') ?? '15m',
            algorithm: 'ES256',
          } as JwtSignOptions,
        };
      },
    }),
    UsersModule,
    ClsModule,
    MailModule,
  ],
  providers: [AuthService, JwtStrategy, ExchangeSecretGuard],
  controllers: [AuthController],
})
export class AuthModule {}
