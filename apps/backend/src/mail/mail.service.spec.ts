import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { TemplateRenderer } from './template.renderer';

describe('MailService', () => {
  let transport: { send: jest.Mock };
  let service: MailService;

  beforeEach(() => {
    transport = { send: jest.fn(async () => undefined) };
    const config = { get: () => 'Acme Inc' } as unknown as ConfigService;
    service = new MailService(transport as any, new TemplateRenderer(config));
  });

  it('sendPasswordReset renders and sends to the recipient', async () => {
    await service.sendPasswordReset('jan@x.com', {
      name: 'Jan',
      resetUrl: 'https://web.test/reset-password?token=RAW',
      ttlMins: 30,
    });

    expect(transport.send).toHaveBeenCalledTimes(1);
    const msg = transport.send.mock.calls[0][0] as any;
    expect(msg.to).toBe('jan@x.com');
    expect(msg.subject).toMatch(/reset/i);
    expect(msg.html).toContain('https://web.test/reset-password?token=RAW');
    expect(msg.text).toContain('https://web.test/reset-password?token=RAW');
  });

  it('sendPasswordChanged renders and sends', async () => {
    await service.sendPasswordChanged('jan@x.com', { name: 'Jan' });
    const msg = transport.send.mock.calls[0][0] as any;
    expect(msg.to).toBe('jan@x.com');
    expect(msg.subject).toMatch(/changed/i);
  });
});
