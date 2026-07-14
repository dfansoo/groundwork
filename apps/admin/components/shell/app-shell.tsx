import Link from "next/link";
import type { Role } from "@/lib/permissions";
import { SidebarNav } from "./sidebar-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";

export function AppShell({
  roles,
  email,
  children,
}: {
  roles: Role[];
  email?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4">
        <Link href="/" className="mb-6 px-3 font-heading text-lg font-semibold tracking-tight">
          Groundwork
        </Link>

        <SidebarNav roles={roles} />

        <div className="mt-auto space-y-2 px-3 pt-6">
          {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
          <SignOutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto p-8">{children}</main>
    </div>
  );
}
