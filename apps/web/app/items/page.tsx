import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { listItems } from "@/lib/api/items";

export const metadata: Metadata = { title: "Items" };

export default async function ItemsPage() {
  const { items } = await listItems();

  return (
    <Container className="py-16">
      <h1 className="mb-8 font-heading text-3xl font-semibold tracking-tight">Items</h1>

      {items.length === 0 ? (
        <p className="text-muted-foreground">Nothing published yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Link key={item.id} href={`/items/${item.slug}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/20">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                {item.description ? (
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
                  </CardContent>
                ) : null}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
