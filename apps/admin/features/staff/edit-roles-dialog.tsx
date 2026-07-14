"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import type { Role } from "@/lib/permissions";
import { RoleCheckboxes } from "./role-checkboxes";
import { replaceRoles, type StaffMember } from "./api";

export function EditRolesDialog({
  member,
  open,
  onOpenChange,
}: {
  member: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [roles, setRoles] = useState<Role[]>(member.roles);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await replaceRoles(member.id, roles);
      toast.success(`Updated roles for ${member.username}`);
      await qc.invalidateQueries({ queryKey: ["staff"] });
      onOpenChange(false);
    } catch (err) {
      // The backend refuses to demote the last SUPER_ADMIN. Surface that reason
      // rather than a generic failure — it is the whole point of the message.
      toast.error(err instanceof Error ? err.message : "Could not update those roles");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles for {member.username}</DialogTitle>
          <DialogDescription>
            Replaces every role this account holds. Takes effect the next time they sign in.
          </DialogDescription>
        </DialogHeader>

        <RoleCheckboxes value={roles} onChange={setRoles} disabled={saving} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || roles.length === 0}>
            {saving ? "Saving…" : "Save roles"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
