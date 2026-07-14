import { auth } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-3">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as {session?.user?.email} ({(session?.user?.roles ?? []).join(", ") || "no roles"}
        ).
      </p>
      <p className="text-sm text-muted-foreground">
        The nav on the left only shows what your roles permit. Start a real feature by copying{" "}
        <code className="rounded bg-muted px-1 py-0.5">features/items</code>.
      </p>
    </div>
  );
}
