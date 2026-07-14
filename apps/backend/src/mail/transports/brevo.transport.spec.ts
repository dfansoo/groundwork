import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { BrevoMailTransport } from './brevo.transport';

const config = {
  apiKey: 'key-123',
  fromEmail: 'no-reply@acme.example',
  fromName: 'Acme Inc',
};

afterEach(() => jest.restoreAllMocks());

describe('BrevoMailTransport', () => {
  it('POSTs the mapped payload to Brevo with the api-key header', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 201 }));
    const transport = new BrevoMailTransport(config);

    await transport.send({
      to: 'jan@x.com',
      subject: 'Hi',
      html: '<p>h</p>',
      text: 't',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect((init.headers as Record<string, string>)['api-key']).toBe('key-123');
    const body = JSON.parse(init.body as string);
    expect(body.sender).toEqual({
      email: config.fromEmail,
      name: config.fromName,
    });
    expect(body.to).toEqual([{ email: 'jan@x.com' }]);
    expect(body.subject).toBe('Hi');
    expect(body.htmlContent).toBe('<p>h</p>');
    expect(body.textContent).toBe('t');
  });

  it('throws when Brevo returns a non-2xx status', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('bad', { status: 400 }));
    const transport = new BrevoMailTransport(config);
    await expect(
      transport.send({ to: 'jan@x.com', subject: 'Hi', html: 'h', text: 't' }),
    ).rejects.toThrow(/Brevo/);
  });
});
