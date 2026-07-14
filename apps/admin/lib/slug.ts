import { z } from "zod";

const MAX_SLUG_LENGTH = 80;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mirrors `slugify` in the backend's `src/common/slug.ts`. Keep the two in step. */
export function slugifyTitle(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/** An empty slug is legal and means "let the backend derive one from the title". */
export const slugField = z
  .string()
  .trim()
  .max(MAX_SLUG_LENGTH)
  .refine((v) => v === "" || SLUG_PATTERN.test(v), {
    message: "Lowercase letters, numbers and single dashes only",
  });
