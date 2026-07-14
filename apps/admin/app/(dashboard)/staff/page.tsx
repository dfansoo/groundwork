import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { StaffTable } from "@/features/staff/staff-table";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const session = await auth();
  const roles = session?.user?.roles ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Staff</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone with a role beyond a plain account. Roles are enforced by the API, not by this
          screen.
        </p>
      </div>

      <StaffTable roles={roles} />
    </div>
  );
}
