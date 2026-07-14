"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/public";
import { resetPasswordSchema } from "@/lib/auth-schema";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";

type Errors = Partial<Record<"password" | "confirm" | "form", string>>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await apiFetch("auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: parsed.data.password }),
      });
    } catch (err) {
      setSubmitting(false);
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 400) {
        setErrors({ form: "This reset link is invalid or has expired. Request a new one." });
      } else if (status === 429) {
        setErrors({ form: "Too many attempts. Please try again shortly." });
      } else {
        setErrors({ form: "Something went wrong. Please try again." });
      }
      return;
    }
    setSubmitting(false);
    toast.success("Password updated — please sign in.");
    router.push("/login");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {errors.form && (
        <p className="text-sm text-destructive" role="alert">
          {errors.form}{" "}
          <Link href="/forgot-password" className="underline">
            Start over
          </Link>
        </p>
      )}
      <Field>
        <FieldLabel htmlFor="reset-password">New password</FieldLabel>
        <Input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!errors.password}
        />
        <FieldError>{errors.password}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
        <Input
          id="reset-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!errors.confirm}
        />
        <FieldError>{errors.confirm}</FieldError>
      </Field>
      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
