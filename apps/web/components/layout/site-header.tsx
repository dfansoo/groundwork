import Link from "next/link";
import { Container } from "./container";
import { NAV_ITEMS } from "./nav-items";
import { AccountMenu } from "@/components/auth/account-menu";
import { auth } from "@/lib/auth";
import { site } from "@/lib/site";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          {site.name}
        </Link>

        <nav className="hidden items-center gap-6 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <AccountMenu user={session?.user ?? null} />
      </Container>
    </header>
  );
}
