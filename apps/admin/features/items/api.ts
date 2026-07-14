import { bffFetch } from "@/lib/api/bff";

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

export type ItemInput = {
  title: string;
  description?: string;
  published?: boolean;
};

export function listItems(page = 1): Promise<ItemPage> {
  return bffFetch<ItemPage>(`admin/items?page=${page}&limit=20`);
}

export function getItem(id: string): Promise<Item> {
  return bffFetch<Item>(`admin/items/${id}`);
}

export function createItem(input: ItemInput): Promise<Item> {
  return bffFetch<Item>("admin/items", { method: "POST", body: JSON.stringify(input) });
}

export function updateItem(id: string, input: Partial<ItemInput>): Promise<Item> {
  return bffFetch<Item>(`admin/items/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteItem(id: string): Promise<void> {
  return bffFetch<void>(`admin/items/${id}`, { method: "DELETE" });
}
