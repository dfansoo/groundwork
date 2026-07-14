import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Button } from "@workspace/ui/components/button";
import { hasPermission } from "@/lib/permissions";
import { ItemsTable } from "@/features/items/items-table";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Items</h1>
        {hasPermission(roles, "ITEMS_WRITE") ? (
          <Button render={<Link href="/items/new" />}>New item</Button>
        ) : null}
      </div>

      <ItemsTable roles={roles} />
    </div>
  );
}
