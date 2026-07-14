"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { bffFetch } from "@/lib/api/bff";
import { RevokeSessionButton } from "@/components/auth/revoke-session-button";

type Profile = { id: string; email: string; username: string; avatar: string | null };
type AuthSession = { id: string; createdAt: string; lastUsedAt: string | null };

export function AccountPanels() {
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => bffFetch<Profile>("auth/profile"),
  });

  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => bffFetch<AuthSession[]>("auth/sessions"),
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {profile.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : profile.isError ? (
            <p className="text-destructive">Could not load your profile.</p>
          ) : (
            <>
              <p>
                <span className="text-muted-foreground mr-2">Username</span>
                {profile.data.username}
              </p>
              <p>
                <span className="text-muted-foreground mr-2">Email</span>
                {profile.data.email}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {sessions.isPending ? (
            <Skeleton className="h-10 w-full" />
          ) : sessions.isError ? (
            <p className="text-destructive">Could not load your sessions.</p>
          ) : sessions.data.length === 0 ? (
            <p className="text-muted-foreground">No active sessions.</p>
          ) : (
            sessions.data.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">
                  Signed in {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <RevokeSessionButton sessionId={s.id} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
