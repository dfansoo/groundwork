"use client";

import { Button } from "@workspace/ui/components/button";

/** The `meta` block every paginated endpoint in the API returns. */
export type PageMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/**
 * The pager for every list in the console.
 *
 * The API has always paginated; without this the tables just rendered page 1
 * forever and row 21 was invisible.
 */
export function Pagination({
  meta,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { page, limit, total, totalPages } = meta;

  if (total === 0) return null;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground" role="status">
        {first}–{last} of {total}
      </p>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
