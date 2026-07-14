"use client";

import { Container } from "@/components/layout/container";
import { Button } from "@workspace/ui/components/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <Container className="py-32 text-center">
        <h1 className="font-serif text-primary text-4xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-md">We hit a snag loading this page. Please try again.</p>
        <Button onClick={reset} className="mt-8">Try again</Button>
      </Container>
    </main>
  );
}
