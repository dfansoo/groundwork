import { describe, it, expect, jest } from '@jest/globals';
import {
  ArgumentsHost,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CustomExceptionFilter } from './exception-filter';

function mockHost(method = 'POST', url = '/admin/hotels') {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = {
    status,
    getHeader: () => undefined,
  };
  const request = { method, originalUrl: url, url };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, json };
}

describe('CustomExceptionFilter', () => {
  const filter = new CustomExceptionFilter();

  it('emits a flat `details` array for validation exceptions (no double-wrap)', () => {
    const { host, json } = mockHost();
    // The exact shape hotels/tours services throw for image validation.
    const details = [
      {
        property: 'imageFileIds',
        constraints: {
          imageFileIds: 'Unknown or not-ready file ids: abc',
        },
      },
    ];

    filter.catch(
      new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        message: 'Validation failed',
        details,
      }),
      host,
    );

    const payload = json.mock.calls[0][0] as Record<string, unknown>;
    // Must be the flat array, NOT { details: [...] }
    expect(payload.details).toEqual(details);
    expect(payload.message).toBe('Validation failed');
    expect(payload.statusCode).toBe(422);
    expect(payload.success).toBe(false);
  });

  it('still groups other non-standard keys under `details`', () => {
    const { host, json } = mockHost();

    filter.catch(
      new HttpException(
        { statusCode: 400, error: 'Bad Request', message: 'nope', hint: 'try again' },
        400,
      ),
      host,
    );

    const payload = json.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.details).toEqual({ hint: 'try again' });
    expect(payload.message).toBe('nope');
  });

  it('omits `details` when the exception carries none', () => {
    const { host, json } = mockHost();
    filter.catch(new HttpException('plain message', 400), host);
    const payload = json.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('details');
    expect(payload.message).toBe('plain message');
  });
});
