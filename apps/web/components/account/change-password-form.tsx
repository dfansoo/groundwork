"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { bffFetch } from "@/lib/api/bff";
import { ApiError } from "@/lib/api/public";
import { changePasswordSchema } from "@/lib/auth-schema";

type Errors = Partial<Record<"currentPassword" | "password" | "confirm" | "form", string>>;

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = changePasswordSchema.safeParse({ currentPassword, password, confirm });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] = issue.message;
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await bffFetch("auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.password,
        }),
      });
    } catch (err) {
      setSubmitting(false);
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 401) {
        setErrors({ currentPassword: "That is not your current password" });
      } else if (status === 429) {
        setErrors({ form: "Too many attempts. Please try again shortly." });
      } else if (err instanceof ApiError && status === 400) {
        setErrors({ form: err.message });
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      return;
    }

    // The API revokes every session on a password change, including this one, so
    // the token in our cookie is already dead. Signing out is the honest thing to
    // do — otherwise the next request just 401s for no visible reason.
    toast.success("Password updated — please sign in again.");
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {errors.form && (
        <p className="text-sm text-destructive" role="alert">
          {errors.form}
        </p>
      )}

      <Field>
        <FieldLabel htmlFor="current-password">Current password</FieldLabel>
        <Input
          id="current-password"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          aria-invalid={!!errors.currentPassword}
        />
        <FieldError>{errors.currentPassword}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="new-password">New password</FieldLabel>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        <FieldError>{errors.password}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
        />
        <FieldError>{errors.confirm}</FieldError>
      </Field>

      <p className="text-xs text-muted-foreground">
        Changing your password signs you out everywhere, on every device.
      </p>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Updating…" : "Change password"}
      </Button>
    </form>
  );
}
