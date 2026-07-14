import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@workspace/ui/components/button";
import { site } from "@/lib/site";

export default function HomePage() {
  return (
    <Container className="flex flex-col items-start gap-6 py-24">
      <h1 className="font-heading max-w-2xl text-5xl font-semibold tracking-tight text-balance">
        {site.name}
      </h1>
      <p className="text-muted-foreground max-w-xl text-lg text-pretty">{site.description}</p>
      <div className="flex gap-3">
        <Button render={<Link href="/items" />}>Browse items</Button>
        <Button variant="outline" render={<Link href="/login" />}>
          Sign in
        </Button>
      </div>
    </Container>
  );
}
