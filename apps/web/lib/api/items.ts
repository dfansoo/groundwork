import { getPublic } from "@/lib/api/public";
import type { components } from "@workspace/api-client";

/**
 * Shapes come from the backend's OpenAPI contract, so a change to the API breaks
 * the build here rather than at runtime.
 */
export type Item = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  published: boolean;
  imageFileIds: string[];
  createdAt: string;
};

export type ItemPage = {
  items: Item[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

export function listItems(page = 1): Promise<ItemPage> {
  return getPublic<ItemPage>("items", { params: { page, limit: 12 } });
}

export function getItem(slug: string): Promise<Item> {
  return getPublic<Item>(`items/${slug}`);
}

// Re-exported so a consumer can reach the generated component schemas directly.
export type { components };
