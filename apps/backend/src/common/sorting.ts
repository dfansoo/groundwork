/**
 * Build a Prisma `orderBy` from an untrusted sortBy/order pair.
 * Only columns in `allowed` are honored; anything else (including an absent
 * sortBy) falls back to `{ [fallback]: 'desc' }`. This keeps `sortBy` from
 * becoming an injection / arbitrary-column vector.
 */
export function buildOrderBy(
  sortBy: string | undefined,
  order: 'asc' | 'desc',
  allowed: readonly string[],
  fallback: string,
): Record<string, 'asc' | 'desc'> {
  if (!sortBy || !allowed.includes(sortBy)) {
    return { [fallback]: 'desc' };
  }
  return { [sortBy]: order };
}
