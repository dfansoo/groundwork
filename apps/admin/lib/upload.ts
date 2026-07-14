import { bffFetch } from "@/lib/api/bff";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the backend cap

export interface UploadedImage {
  fileId: string;
  url: string;
}

/**
 * Three-step presigned upload:
 *   1. POST /v1/admin/files/uploads (via BFF)  -> { assetId, uploadUrl }
 *   2. PUT the bytes directly to `uploadUrl`   (NOT through the BFF)
 *   3. POST /v1/admin/files/:id/confirm (via BFF) -> the READY asset (public `url`)
 */
export async function uploadImage(file: File, kind = "item"): Promise<UploadedImage> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}. Use JPEG, PNG, or WebP.`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 10 MB).");
  }

  const ticket = await bffFetch<{ assetId: string; uploadUrl: string }>("admin/files/uploads", {
    method: "POST",
    body: JSON.stringify({
      visibility: "public",
      kind,
      filename: file.name,
      contentType: file.type,
    }),
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload to storage failed (${put.status}).`);
  }

  const asset = await bffFetch<{ id: string; url: string | null }>(
    `admin/files/${ticket.assetId}/confirm`,
    { method: "POST" },
  );
  return { fileId: asset.id, url: asset.url ?? "" };
}
