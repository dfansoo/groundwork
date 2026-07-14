import { PaginationQueryDto } from './dto/pagination-query.dto';

export interface PaginatedResult<T> {
  items: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function getPaginationParams(query: PaginationQueryDto): {
  skip: number;
  take: number;
  page: number;
  limit: number;
} {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    items,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
