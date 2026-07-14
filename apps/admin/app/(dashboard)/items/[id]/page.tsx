import type { Metadata } from "next";
import { EditItem } from "@/features/items/edit-item";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Edit item</h1>
      <EditItem id={id} />
    </div>
  );
}
