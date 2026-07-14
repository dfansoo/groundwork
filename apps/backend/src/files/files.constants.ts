// Canonical logical `kind` groups accepted by the Files module (DTO-validated via @IsIn).
// Add one per model that owns uploads — `item` belongs to the example feature.
export const FILE_KINDS = [
  'item',
  'avatar',
  'banner',
  'document',
  'misc',
] as const;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const DOC_TYPES = [...IMAGE_TYPES, 'application/pdf'] as const;

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DOC_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

// Kinds allowed to hold documents (PDF). Everything else is image-only.
const DOCUMENT_KINDS = new Set(['document']);

export function allowedContentTypes(kind: string): readonly string[] {
  return DOCUMENT_KINDS.has(kind) ? DOC_TYPES : IMAGE_TYPES;
}

export function maxBytesForKind(kind: string): number {
  return DOCUMENT_KINDS.has(kind) ? DOC_MAX_BYTES : IMAGE_MAX_BYTES;
}

export function extForContentType(contentType: string): string {
  return EXT_BY_TYPE[contentType] ?? '';
}
