import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailTransport } from '../mail.types';

@Injectable()
export class LogMailTransport implements MailTransport {
  private readonly logger = new Logger('MailTransport:log');

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `Email -> ${message.to} | ${message.subject}\n${message.text}`,
    );
  }
}
