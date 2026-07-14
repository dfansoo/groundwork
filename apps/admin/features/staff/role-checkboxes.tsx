"use client";

import { useId } from "react";
import { Checkbox } from "@workspace/ui/components/checkbox";
import type { Role } from "@/lib/permissions";

/**
 * USER is deliberately absent. It is the role a self-registered account gets and
 * carries no permissions at all, so granting it from the staff screen would look
 * like access while conferring none.
 */
export const ASSIGNABLE_ROLES: { role: Role; description: string }[] = [
  { role: "SUPER_ADMIN", description: "Everything, including managing staff" },
  { role: "ADMIN", description: "Everything except granting roles" },
  { role: "EDITOR", description: "Create and edit content" },
  { role: "VIEWER", description: "Read-only" },
];

export function RoleCheckboxes({
  value,
  onChange,
  disabled = false,
}: {
  value: Role[];
  onChange: (roles: Role[]) => void;
  disabled?: boolean;
}) {
  const prefix = useId();

  function toggle(role: Role, checked: boolean) {
    onChange(checked ? [...value, role] : value.filter((r) => r !== role));
  }

  return (
    <div className="space-y-3">
      {ASSIGNABLE_ROLES.map(({ role, description }) => {
        const id = `${prefix}-${role}`;

        return (
          <div key={role} className="flex items-start gap-3 text-sm">
            <Checkbox
              id={id}
              checked={value.includes(role)}
              onCheckedChange={(checked) => toggle(role, checked === true)}
              disabled={disabled}
              aria-describedby={`${id}-description`}
            />
            <div className="grid gap-0.5 leading-tight">
              {/* The label carries the role and nothing else, so the accessible
                  name is exactly "ADMIN" — not "ADMIN Everything except granting
                  roles", which no assistive tech (and no test) can match cleanly
                  against its neighbour SUPER_ADMIN. */}
              <label htmlFor={id} className="font-medium">
                {role}
              </label>
              <span id={`${id}-description`} className="text-xs text-muted-foreground">
                {description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
