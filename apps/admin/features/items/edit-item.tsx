"use client";

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { getItem } from "./api";
import { ItemForm } from "./item-form";

export function EditItem({ id }: { id: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["items", id],
    queryFn: () => getItem(id),
  });

  if (isPending) return <Skeleton className="h-64 w-full max-w-xl" />;
  if (isError) return <p className="text-destructive">Could not load that item.</p>;

  return <ItemForm item={data} />;
}
