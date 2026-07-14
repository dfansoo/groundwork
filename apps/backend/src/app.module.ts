import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StaffModule } from './staff/staff.module';
import { AuditModule } from './audit/audit.module';
import { FilesModule } from './files/files.module';
import { ItemsModule } from './items/items.module';
import { MailModule } from './mail/mail.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { validationSchema } from './config/env.validation';
import { throttlers } from './auth/throttle.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ThrottlerModule.forRoot(throttlers),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({ global: true, middleware: { mount: true } }),
    PrismaModule,
    CryptoModule,
    MailModule,
    UsersModule,
    AuthModule,
    StaffModule,
    AuditModule,
    FilesModule,
    ItemsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Without this the ThrottlerModule above is inert: nothing reads its config
    // and every @Throttle() in the codebase is decorative. It has to be a global
    // guard for the rate limits to exist at all.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
