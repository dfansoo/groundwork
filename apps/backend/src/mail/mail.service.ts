import { Inject, Injectable } from '@nestjs/common';
import { MAIL_TRANSPORT_TOKEN, MailTransport } from './mail.types';
import { TemplateRenderer } from './template.renderer';

/**
 * Add a method per email your product sends, and a matching pair of templates
 * (`<name>.hbs` for HTML, `<name>.text.hbs` for the plaintext part) under
 * ./templates. MAIL_TRANSPORT=log renders them to the server log in dev.
 */
@Injectable()
export class MailService {
  constructor(
    @Inject(MAIL_TRANSPORT_TOKEN) private readonly transport: MailTransport,
    private readonly renderer: TemplateRenderer,
  ) {}

  async sendPasswordReset(
    to: string,
    data: { name: string; resetUrl: string; ttlMins: number },
  ): Promise<void> {
    const msg = this.renderer.render('password-reset', data);
    await this.transport.send({ to, ...msg });
  }

  async sendPasswordChanged(to: string, data: { name: string }): Promise<void> {
    const msg = this.renderer.render('password-changed', data);
    await this.transport.send({ to, ...msg });
  }
}
