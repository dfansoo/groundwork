"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Pagination } from "@/components/data/pagination";
import { hasPermission, type Role } from "@/lib/permissions";
import { listStaff, revokeStaffAccess, type StaffMember } from "./api";
import { ASSIGNABLE_ROLES } from "./role-checkboxes";
import { EditRolesDialog } from "./edit-roles-dialog";

const ANY_ROLE = "__any__";

export function StaffTable({ roles }: { roles: Role[] }) {
  const qc = useQueryClient();
  const canWrite = hasPermission(roles, "STAFF_WRITE");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>(ANY_ROLE);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [revoking, setRevoking] = useState<StaffMember | null>(null);

  const query = {
    page,
    search: search.trim() || undefined,
    role: role === ANY_ROLE ? undefined : (role as Role),
  };

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["staff", query],
    queryFn: () => listStaff(query),
    placeholderData: keepPreviousData,
  });

  async function confirmRevoke() {
    if (!revoking) return;
    const member = revoking;

    try {
      await revokeStaffAccess(member.id);
      toast.success(`Revoked ${member.username}'s access`);
      await qc.invalidateQueries({ queryKey: ["staff"] });
    } catch (err) {
      // The backend refuses to strand the system without a SUPER_ADMIN, and
      // refuses to let you revoke your own access. Show it verbatim.
      toast.error(err instanceof Error ? err.message : "Could not revoke that access");
    } finally {
      setRevoking(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name or email"
          value={search}
          aria-label="Search staff"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-xs"
        />
        <Select
          value={role}
          onValueChange={(v) => {
            // Base UI emits null when the selection is cleared.
            setRole(v ?? ANY_ROLE);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-48" aria-label="Filter by role">
            <SelectValue placeholder="Any role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_ROLE}>Any role</SelectItem>
            {ASSIGNABLE_ROLES.map(({ role: r }) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canWrite ? (
          <Button className="ml-auto" render={<Link href="/staff/new" />}>
            Add staff
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <p className="text-destructive">Could not load staff.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    No staff match that search.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.username}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {member.roles.map((r) => (
                          <Badge key={r} variant={r === "SUPER_ADMIN" ? "default" : "secondary"}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {canWrite ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setEditing(member)}>
                            Edit roles
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setRevoking(member)}>
                            Revoke
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination meta={data.meta} onPageChange={setPage} disabled={isFetching} />
        </>
      )}

      {editing ? (
        <EditRolesDialog
          key={editing.id}
          member={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
        />
      ) : null}

      <AlertDialog open={revoking !== null} onOpenChange={(open) => !open && setRevoking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revoking?.username}&apos;s access?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes every role and signs them out everywhere. The account itself remains, so
              they keep any non-staff access they had. You can grant the roles back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke}>Revoke access</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
