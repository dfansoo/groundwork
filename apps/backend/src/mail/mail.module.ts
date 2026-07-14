import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_TRANSPORT_TOKEN, MailTransport } from './mail.types';
import { TemplateRenderer } from './template.renderer';
import { MailService } from './mail.service';
import { LogMailTransport } from './transports/log.transport';
import { BrevoMailTransport } from './transports/brevo.transport';

@Module({
  imports: [ConfigModule],
  providers: [
    TemplateRenderer,
    MailService,
    {
      provide: MAIL_TRANSPORT_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): MailTransport => {
        if (config.get<string>('MAIL_TRANSPORT') === 'brevo') {
          return new BrevoMailTransport({
            apiKey: config.getOrThrow<string>('BREVO_API_KEY'),
            fromEmail: config.getOrThrow<string>('MAIL_FROM_EMAIL'),
            fromName: config.getOrThrow<string>('MAIL_FROM_NAME'),
          });
        }
        return new LogMailTransport();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
