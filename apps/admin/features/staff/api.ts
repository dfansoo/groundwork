import { bffFetch } from "@/lib/api/bff";
import type { Role } from "@/lib/permissions";
import type { PageMeta } from "@/components/data/pagination";

export type StaffMember = {
  id: string;
  email: string;
  username: string;
  roles: Role[];
  createdAt: string;
};

export type StaffPage = { items: StaffMember[]; meta: PageMeta };

export type StaffInput = {
  email: string;
  username: string;
  password: string;
  roles: Role[];
};

export type StaffQuery = {
  page?: number;
  search?: string;
  role?: Role | "";
};

export function listStaff({ page = 1, search, role }: StaffQuery = {}): Promise<StaffPage> {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (role) params.set("role", role);

  return bffFetch<StaffPage>(`admin/staff?${params}`);
}

export function createStaff(input: StaffInput): Promise<StaffMember> {
  return bffFetch<StaffMember>("admin/staff", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function replaceRoles(id: string, roles: Role[]): Promise<StaffMember> {
  return bffFetch<StaffMember>(`admin/staff/${id}/roles`, {
    method: "PATCH",
    body: JSON.stringify({ roles }),
  });
}

/**
 * Strips every role and revokes every session. The account itself survives — the
 * person can still sign in to the public site, they just have no staff access.
 */
export function revokeStaffAccess(id: string): Promise<void> {
  return bffFetch<void>(`admin/staff/${id}`, { method: "DELETE" });
}
