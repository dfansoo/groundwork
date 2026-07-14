import { describe, it, expect } from '@jest/globals';
import { getPaginationParams, buildPaginatedResult } from './pagination';

describe('pagination', () => {
  it('computes skip/take from page and limit', () => {
    expect(getPaginationParams({ page: 3, limit: 20, order: 'desc' })).toEqual({
      skip: 40,
      take: 20,
      page: 3,
      limit: 20,
    });
  });

  it('builds a paginated result with totalPages', () => {
    const result = buildPaginatedResult([{ id: '1' }], 45, 1, 20);
    expect(result).toEqual({
      items: [{ id: '1' }],
      meta: { total: 45, page: 1, limit: 20, totalPages: 3 },
    });
  });
});
