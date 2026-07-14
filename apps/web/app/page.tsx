import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@workspace/ui/components/button";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24">
      <h1 className="max-w-2xl font-heading text-5xl font-semibold tracking-tight text-balance">
        {site.name}
      </h1>
      <p className="max-w-xl text-lg text-pretty text-muted-foreground">{site.description}</p>
      <div className="flex gap-3">
        <Button render={<Link href="/items" />}>Browse items</Button>
        <Button variant="outline" render={<Link href="/login" />}>
          Sign in
        </Button>
      </div>
    </Container>
  );
}
