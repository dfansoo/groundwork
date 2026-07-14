import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ApiError } from "@/lib/api/public";
import { getItem, type Item } from "@/lib/api/items";

async function load(slug: string): Promise<Item | null> {
  try {
    return await getItem(slug);
  } catch (err) {
    // A draft is indistinguishable from a missing item — the API 404s either way.
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await load(slug);
  return { title: item?.title ?? "Not found" };
}

export default async function ItemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await load(slug);
  if (!item) notFound();

  return (
    <Container className="max-w-3xl py-16">
      <h1 className="mb-6 font-heading text-4xl font-semibold tracking-tight text-balance">
        {item.title}
      </h1>
      {item.description ? (
        <p className="text-lg leading-relaxed text-pretty text-muted-foreground">
          {item.description}
        </p>
      ) : null}
    </Container>
  );
}
