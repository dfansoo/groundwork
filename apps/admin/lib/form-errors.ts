import type { UseFormSetError, FieldValues, Path } from "react-hook-form";
import { ApiError } from "@/lib/api/public";

// Maps a backend 422 ApiError (details: [{ property, constraints }]) onto RHF fields.
// Returns true if at least one field error was applied (caller can skip the generic toast then).
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError)) return false;
  // The backend exception filter double-wraps validation details as `{ details: [...] }`
  // (it re-nests the thrown body's own `details` key). Accept the flat array OR the wrapped shape.
  const raw = error.details;
  const details: unknown = Array.isArray(raw)
    ? raw
    : (raw as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) return false;
  let applied = false;
  for (const d of details as Array<{ property?: string; constraints?: Record<string, string> }>) {
    if (d.property && d.constraints) {
      const message = Object.values(d.constraints)[0] ?? "Invalid value";
      setError(d.property as Path<T>, { type: "server", message });
      applied = true;
    }
  }
  return applied;
}
