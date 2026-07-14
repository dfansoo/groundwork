import { describe, it, expect } from '@jest/globals';
import { buildOrderBy } from './sorting';

describe('buildOrderBy', () => {
  const allowed = ['title', 'basePriceMinor', 'createdAt'] as const;

  it('uses a whitelisted column with the given order', () => {
    expect(buildOrderBy('title', 'asc', allowed, 'createdAt')).toEqual({ title: 'asc' });
  });

  it('falls back to the default column (desc) when sortBy is unknown', () => {
    expect(buildOrderBy('hacker; DROP', 'asc', allowed, 'createdAt')).toEqual({ createdAt: 'desc' });
  });

  it('falls back to the default column (desc) when sortBy is absent', () => {
    expect(buildOrderBy(undefined, 'asc', allowed, 'createdAt')).toEqual({ createdAt: 'desc' });
  });
});
