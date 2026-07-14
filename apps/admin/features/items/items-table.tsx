"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { hasPermission, type Role } from "@/lib/permissions";
import { deleteItem, listItems } from "./api";

export function ItemsTable({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const canWrite = hasPermission(roles, "ITEMS_WRITE");

  const { data, isPending, isError } = useQuery({
    queryKey: ["items"],
    queryFn: () => listItems(),
  });

  async function remove(id: string, title: string) {
    try {
      await deleteItem(id);
      toast.success(`Deleted “${title}”`);
      await qc.invalidateQueries({ queryKey: ["items"] });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete that item");
    }
  }

  if (isPending) return <Skeleton className="h-40 w-full" />;
  if (isError) return <p className="text-destructive">Could not load items.</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground">
              No items yet.
            </TableCell>
          </TableRow>
        ) : (
          data.items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.title}</TableCell>
              <TableCell>
                <Badge variant={item.published ? "default" : "secondary"}>
                  {item.published ? "Published" : "Draft"}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(item.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {canWrite ? (
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" render={<Link href={`/items/${item.id}`} />}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(item.id, item.title)}>
                      Delete
                    </Button>
                  </div>
                ) : null}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
