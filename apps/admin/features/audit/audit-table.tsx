"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
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
import type { Role } from "@/lib/permissions";
import { ASSIGNABLE_ROLES } from "@/features/staff/role-checkboxes";
import { exportAuditCsv, listAuditEvents, type AuditEvent } from "./api";

const ANY_ROLE = "__any__";

/** `items.create` -> `create`, so the verb reads without repeating the entity column. */
function verb(action: string): string {
  const [, ...rest] = action.split(".");
  return rest.join(".") || action;
}

function actionTone(action: string): "default" | "secondary" | "destructive" {
  if (action.includes("delete") || action.includes("deactivate")) return "destructive";
  if (action.includes("create")) return "default";
  return "secondary";
}

function Actor({ actor }: { actor: AuditEvent["actor"] }) {
  // A null actor is a real state, not missing data: the event had no signed-in
  // user behind it (the orphan-asset sweep, for one).
  if (!actor) return <span className="text-muted-foreground italic">System</span>;

  return (
    <span>
      {actor.username}
      <span className="block text-xs text-muted-foreground">{actor.email}</span>
    </span>
  );
}

export function AuditTable() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [role, setRole] = useState<string>(ANY_ROLE);
  const [exporting, setExporting] = useState(false);

  const filters = {
    page,
    from: from || undefined,
    to: to || undefined,
    role: role === ANY_ROLE ? undefined : (role as Role),
  };

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: ["audit-events", filters],
    queryFn: () => listAuditEvents(filters),
    placeholderData: keepPreviousData,
  });

  async function download() {
    setExporting(true);
    try {
      await exportAuditCsv(filters);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not export the log");
    } finally {
      setExporting(false);
    }
  }

  function reset(next: () => void) {
    next();
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">From</span>
          <Input
            type="date"
            value={from}
            aria-label="From date"
            onChange={(e) => reset(() => setFrom(e.target.value))}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">To</span>
          <Input
            type="date"
            value={to}
            aria-label="To date"
            onChange={(e) => reset(() => setTo(e.target.value))}
          />
        </label>

        {/* Base UI emits null when the selection is cleared. */}
        <Select value={role} onValueChange={(v) => reset(() => setRole(v ?? ANY_ROLE))}>
          <SelectTrigger className="w-44" aria-label="Filter by actor role">
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

        <Button
          variant="outline"
          className="ml-auto"
          onClick={download}
          disabled={exporting || isPending}
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <p className="text-destructive">Could not load the audit log.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No events match those filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Actor actor={event.actor} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionTone(event.action)}>{verb(event.action)}</Badge>
                    </TableCell>
                    <TableCell>
                      {event.entity}
                      <span className="block font-mono text-xs text-muted-foreground">
                        {event.entityId}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <Pagination meta={data.meta} onPageChange={setPage} disabled={isFetching} />
        </>
      )}
    </div>
  );
}
