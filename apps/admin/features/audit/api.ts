import { bffDownload, bffFetch } from "@/lib/api/bff";
import type { Role } from "@/lib/permissions";
import type { PageMeta } from "@/components/data/pagination";

export type AuditActor = {
  id: string;
  username: string;
  email: string;
  roles: Role[];
};

export type AuditEvent = {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
  meta: unknown;
  /** Null for an event with no signed-in actor — a scheduled job, say. */
  actor: AuditActor | null;
};

export type AuditPage = { items: AuditEvent[]; meta: PageMeta };

export type AuditFilters = {
  page?: number;
  from?: string;
  to?: string;
  role?: Role | "";
};

function toParams({ page = 1, from, to, role }: AuditFilters): URLSearchParams {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (role) params.set("role", role);
  return params;
}

export function listAuditEvents(filters: AuditFilters = {}): Promise<AuditPage> {
  return bffFetch<AuditPage>(`admin/audit-events?${toParams(filters)}`);
}

/** Exports the *filtered* set, capped server-side at 5000 rows. */
export function exportAuditCsv(filters: AuditFilters = {}): Promise<void> {
  const params = toParams(filters);
  params.delete("page");
  params.delete("limit");

  return bffDownload(`admin/audit-events/export.csv?${params}`, "audit-events.csv");
}
