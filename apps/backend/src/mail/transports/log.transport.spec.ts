import { describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { LogMailTransport } from './log.transport';

describe('LogMailTransport', () => {
  it('logs the message and resolves', async () => {
    const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const transport = new LogMailTransport();

    await expect(
      transport.send({ to: 'a@b.com', subject: 'Hi', html: '<p>x</p>', text: 'x' }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('a@b.com');
    expect(String(spy.mock.calls[0][0])).toContain('Hi');
    spy.mockRestore();
  });
});
