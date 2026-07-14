import { Container } from "./container";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-border/60 mt-24 border-t py-10">
      <Container className="text-muted-foreground flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          &copy; {new Date().getFullYear()} {site.name}
        </span>
        <span>Built from the groundwork template.</span>
      </Container>
    </footer>
  );
}
