import type { Metadata } from "next";
import { AuditTable } from "@/features/audit/audit-table";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every mutation, against the account that made it. Append-only — nothing here can be edited
          or deleted through the API.
        </p>
      </div>

      <AuditTable />
    </div>
  );
}
