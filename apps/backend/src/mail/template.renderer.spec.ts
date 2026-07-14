import { describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { TemplateRenderer } from './template.renderer';

describe('TemplateRenderer', () => {
  const config = { get: () => 'Acme Inc' } as unknown as ConfigService;
  const renderer = new TemplateRenderer(config);

  it('renders the password-reset email with the link, name and TTL', () => {
    const out = renderer.render('password-reset', {
      name: 'Jan',
      resetUrl: 'https://web.test/reset-password?token=RAWTOKEN',
      ttlMins: 30,
    });

    expect(out.subject).toMatch(/reset/i);
    expect(out.html).toContain('https://web.test/reset-password?token=RAWTOKEN');
    expect(out.html).toContain('Jan');
    expect(out.text).toContain('https://web.test/reset-password?token=RAWTOKEN');
    expect(out.text).toContain('30');
  });

  it('brands the email from MAIL_FROM_NAME rather than hardcoded copy', () => {
    const out = renderer.render('password-reset', {
      name: 'Jan',
      resetUrl: 'https://web.test/reset-password?token=RAWTOKEN',
      ttlMins: 30,
    });

    expect(out.subject).toContain('Acme Inc');
    expect(out.html).toContain('Acme Inc'); // layout brand header
    expect(out.text).toContain('Acme Inc');
  });

  it('renders the password-changed email', () => {
    const out = renderer.render('password-changed', { name: 'Jan' });
    expect(out.subject).toMatch(/changed/i);
    expect(out.html).toContain('Jan');
    expect(out.text.length).toBeGreaterThan(0);
  });
});
