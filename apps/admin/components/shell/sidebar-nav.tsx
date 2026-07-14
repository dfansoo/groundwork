"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@workspace/ui/lib/utils";
import { hasPermission, type Role } from "@/lib/permissions";
import { NAV_ITEMS } from "./nav-items";

export function SidebarNav({ roles }: { roles: Role[] }) {
  const pathname = usePathname();

  // Hiding a link is UX, not security — the backend rejects the call regardless.
  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(roles, item.permission),
  );

  return (
    <nav className="flex flex-col gap-1">
      {visible.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
