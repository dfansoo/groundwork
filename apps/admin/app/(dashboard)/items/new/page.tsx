import type { Metadata } from "next";
import { ItemForm } from "@/features/items/item-form";

export const metadata: Metadata = { title: "New item" };

export default function NewItemPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">New item</h1>
      <ItemForm />
    </div>
  );
}
