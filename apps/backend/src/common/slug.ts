import { randomUUID } from 'node:crypto';
import { UnprocessableEntityException } from '@nestjs/common';

const MAX_SLUG_LENGTH = 80;
/** Attempts 2..5 append `-2`..`-5`; the rest append a random token. */
const LINEAR_SLUG_ATTEMPTS = 5;
const MAX_SLUG_ATTEMPTS = 20;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '');
}

interface PrismaConflictLike {
  code?: unknown;
  meta?: {
    /** Engine client: `['slug']`, or an index name on some drivers. */
    target?: unknown;
    /** Driver adapters (`@prisma/adapter-pg`) nest it here and omit `target` entirely. */
    driverAdapterError?: {
      cause?: {
        constraint?: { fields?: unknown; index?: unknown };
        originalMessage?: unknown;
      };
    };
  };
}

/**
 * Prisma reports a unique-constraint violation as `code: 'P2002'`, but where it puts
 * the offending column depends on the client. The engine client sets `meta.target`;
 * `@prisma/adapter-pg` leaves `meta.target` undefined and buries the field list under
 * `meta.driverAdapterError.cause.constraint.fields`. Check every known location —
 * missing one means a collision escapes as an unhandled 500.
 *
 * Duck-typed rather than `instanceof` so this module stays Prisma-free.
 */
function isSlugConflict(err: unknown): boolean {
  const e = err as PrismaConflictLike | null;
  if (!e || e.code !== 'P2002') return false;

  const cause = e.meta?.driverAdapterError?.cause;
  const candidates: unknown[] = [
    e.meta?.target,
    cause?.constraint?.fields,
    cause?.constraint?.index,
    cause?.originalMessage,
  ];

  return candidates.some((c) => {
    const text = Array.isArray(c)
      ? c.join(',')
      : typeof c === 'string'
        ? c
        : '';
    return text.includes('slug');
  });
}

function slugTaken(slug: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: 422,
    error: 'Unprocessable Entity',
    message: 'Validation failed',
    details: [
      {
        property: 'slug',
        constraints: { slug: `Slug "${slug}" is already in use` },
      },
    ],
  });
}

export async function resolveSlug<T>(
  explicit: string | undefined,
  title: string,
  create: (slug: string) => Promise<T>,
): Promise<T> {
  if (explicit) {
    // An admin who typed a slug is told it is taken; we never rename it for them.
    try {
      return await create(explicit);
    } catch (err) {
      if (isSlugConflict(err)) throw slugTaken(explicit);
      throw err;
    }
  }

  // A title with no alphanumerics ("***") slugifies to ''. The row id does not
  // exist until after the insert, so there is nothing to fall back on but a mint.
  const root = slugify(title) || randomUUID();

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
    // Linear probing gives the first few duplicates a readable URL. Past that it
    // degrades badly — a title cloned hundreds of times would burn a round-trip per
    // attempt and still collide — so fall back to a random token.
    let slug: string;
    if (attempt === 1) slug = root;
    else if (attempt <= LINEAR_SLUG_ATTEMPTS) slug = `${root}-${attempt}`;
    else slug = `${root}-${randomUUID().slice(0, 8)}`;

    try {
      return await create(slug);
    } catch (err) {
      if (!isSlugConflict(err)) throw err;
    }
  }
  throw slugTaken(root);
}

export async function withSlugConflict<T>(
  slug: string,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (isSlugConflict(err)) throw slugTaken(slug);
    throw err;
  }
}
