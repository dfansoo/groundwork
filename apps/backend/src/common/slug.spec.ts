import { describe, it, expect, jest } from '@jest/globals';
import { UnprocessableEntityException } from '@nestjs/common';
import { slugify, resolveSlug, withSlugConflict } from './slug';

/** Shaped like a Prisma P2002 from the engine client. `slug.ts` duck-types it. */
function slugConflictError(target: unknown = ['slug']) {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { target },
  });
}

/**
 * The shape `@prisma/adapter-pg` actually throws — captured from a live collision.
 * Note the complete absence of `meta.target`.
 */
function driverAdapterConflictError() {
  return Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: {
      modelName: 'Item',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          originalMessage:
            'duplicate key value violates unique constraint "Item_slug_key"',
          kind: 'UniqueConstraintViolation',
          constraint: { fields: ['slug'] },
        },
      },
    },
  });
}

describe('slugify', () => {
  it('lowercases and dashes word runs', () => {
    expect(slugify('Hello Brave New World')).toBe('hello-brave-new-world');
  });

  it('strips diacritics and collapses punctuation runs', () => {
    expect(slugify('Café  Crème!!')).toBe('cafe-creme');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Hello--  ')).toBe('hello');
  });

  it('returns an empty string when nothing alphanumeric survives', () => {
    expect(slugify('***')).toBe('');
  });

  it('truncates to 80 chars and never ends on a dash', () => {
    const long = slugify('a'.repeat(79) + ' bc');
    expect(long).toBe('a'.repeat(79));
    expect(slugify('a'.repeat(100))).toHaveLength(80);
  });
});

describe('resolveSlug', () => {
  it('derives the slug from the title when none is supplied', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockResolvedValue('ok');
    await resolveSlug(undefined, 'Wildlife Escape', create);
    expect(create).toHaveBeenCalledWith('wildlife-escape');
  });

  it('retries a derived slug with a numeric suffix on collision', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValueOnce(slugConflictError())
      .mockResolvedValueOnce('ok');
    await expect(
      resolveSlug(undefined, 'Wildlife Escape', create),
    ).resolves.toBe('ok');
    expect(create).toHaveBeenNthCalledWith(1, 'wildlife-escape');
    expect(create).toHaveBeenNthCalledWith(2, 'wildlife-escape-2');
  });

  it('mints a slug when the title has no alphanumerics', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockResolvedValue('ok');
    await resolveSlug(undefined, '***', create);
    expect(create.mock.calls[0][0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('never renames an explicitly supplied slug — it reports 422', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValue(slugConflictError());
    await expect(
      resolveSlug('taken', 'Anything', create),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('rethrows errors that are not slug conflicts', async () => {
    const boom = new Error('connection reset');
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValue(boom);
    await expect(resolveSlug(undefined, 'X', create)).rejects.toBe(boom);
  });

  it('recognises a conflict reported as an index name rather than a field list', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValueOnce(slugConflictError('Item_slug_key'))
      .mockResolvedValueOnce('ok');
    await expect(resolveSlug(undefined, 'X', create)).resolves.toBe('ok');
  });

  // Regression: @prisma/adapter-pg omits meta.target entirely. Reading only
  // meta.target let every real collision escape as an unhandled 500.
  it('recognises the driver-adapter conflict shape, which has no meta.target', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValueOnce(driverAdapterConflictError())
      .mockResolvedValueOnce('ok');
    await expect(
      resolveSlug(undefined, 'Wildlife Escape', create),
    ).resolves.toBe('ok');
    expect(create).toHaveBeenNthCalledWith(2, 'wildlife-escape-2');
  });

  it('falls back to a random token once linear probing is exhausted', async () => {
    const create = jest.fn<(s: string) => Promise<string>>();
    // Reject wildlife-escape, -2, -3, -4, -5; the 6th attempt must not be `-6`.
    for (let i = 0; i < 5; i += 1)
      create.mockRejectedValueOnce(driverAdapterConflictError());
    create.mockResolvedValueOnce('ok');

    await expect(
      resolveSlug(undefined, 'Wildlife Escape', create),
    ).resolves.toBe('ok');
    expect(create).toHaveBeenNthCalledWith(5, 'wildlife-escape-5');
    expect(create.mock.calls[5][0]).toMatch(/^wildlife-escape-[0-9a-f]{8}$/);
  });

  it('gives up after the attempt budget rather than looping forever', async () => {
    const create = jest
      .fn<(s: string) => Promise<string>>()
      .mockRejectedValue(driverAdapterConflictError());
    await expect(
      resolveSlug(undefined, 'Wildlife Escape', create),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(create).toHaveBeenCalledTimes(20);
  });
});

describe('withSlugConflict', () => {
  it('translates a slug conflict into 422', async () => {
    await expect(
      withSlugConflict('taken', () => Promise.reject(slugConflictError())),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('passes the result through when there is no conflict', async () => {
    await expect(
      withSlugConflict('free', () => Promise.resolve(7)),
    ).resolves.toBe(7);
  });
});
