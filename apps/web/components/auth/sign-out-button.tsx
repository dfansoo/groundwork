"use client";

import { signOut } from "next-auth/react";
import { DropdownMenuItem } from "@workspace/ui/components/dropdown-menu";

export function SignOutButton() {
  return (
    <DropdownMenuItem variant="destructive" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </DropdownMenuItem>
  );
}
