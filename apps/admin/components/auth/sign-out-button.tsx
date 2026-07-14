"use client";

import { signOut } from "next-auth/react";
import { Button } from "@workspace/ui/components/button";

/**
 * Standalone button — the admin sidebar renders it directly. (The web app's
 * version is a DropdownMenuItem, which only works inside a menu.)
 */
export function SignOutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Sign out
    </Button>
  );
}
