"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import { bffFetch } from "@/lib/api/bff";

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function revoke() {
    setPending(true);
    try {
      await bffFetch(`auth/sessions/${sessionId}`, { method: "DELETE" });
      toast.success("Session revoked");
      router.refresh();
    } catch {
      toast.error("Could not revoke that session");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={revoke} disabled={pending}>
      {pending ? "Revoking…" : "Revoke"}
    </Button>
  );
}
