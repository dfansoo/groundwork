import { Container } from "./container";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 py-10">
      <Container className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          &copy; {new Date().getFullYear()} {site.name}
        </span>
        <span>Built from the groundwork template.</span>
      </Container>
    </footer>
  );
}
