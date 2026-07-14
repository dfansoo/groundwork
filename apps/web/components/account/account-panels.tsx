"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { bffFetch } from "@/lib/api/bff";
import { RevokeSessionButton } from "@/components/auth/revoke-session-button";
import { ChangePasswordForm } from "@/components/account/change-password-form";

type Profile = {
  id: string;
  email: string;
  username: string;
  avatar: string | null;
  /** False for a provider-only account, which has no password to change. */
  hasPassword: boolean;
};
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
                <span className="mr-2 text-muted-foreground">Username</span>
                {profile.data.username}
              </p>
              <p>
                <span className="mr-2 text-muted-foreground">Email</span>
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

      {/* Hidden for a provider-only account: it has no password, so the form
          could only ever return an error explaining that. */}
      {profile.data?.hasPassword ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
