import { MailMessage, MailTransport } from '../mail.types';

export interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export class BrevoMailTransport implements MailTransport {
  constructor(private readonly config: BrevoConfig) {}

  async send(message: MailMessage): Promise<void> {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.config.apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: this.config.fromEmail, name: this.config.fromName },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Brevo send failed (${res.status}): ${detail}`);
    }
  }
}
