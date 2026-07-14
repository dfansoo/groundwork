import Link from "next/link";
import { Container } from "@/components/layout/container";
import { Button } from "@workspace/ui/components/button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-6 py-32">
      <h1 className="font-heading text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-muted-foreground">That page doesn&apos;t exist or has moved.</p>
      <Button render={<Link href="/" />}>Back to home</Button>
    </Container>
  );
}
