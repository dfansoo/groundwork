"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/public";
import { registerSchema } from "@/lib/auth-schema";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { GoogleButton } from "./google-button";

type Errors = Partial<Record<"name" | "email" | "password", string>>;

export function RegisterForm({ callbackUrl = "/account" }: { callbackUrl?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as keyof Errors] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await apiFetch("auth/register", {
        method: "POST",
        body: JSON.stringify({ username: parsed.data.name, email: parsed.data.email, password: parsed.data.password }),
      });
    } catch (err) {
      setSubmitting(false);
      const status = err instanceof ApiError ? err.status : 0;
      if (status === 409) {
        setErrors({ email: "An account with this email already exists." });
      } else {
        toast.error("Couldn't create your account. Please try again.");
      }
      return;
    }
    const res = await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
    setSubmitting(false);
    if (res?.error) {
      toast.success("Account created — please sign in.");
      router.push("/login");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <GoogleButton callbackUrl={callbackUrl} />
      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> or <span className="bg-border h-px flex-1" />
      </div>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field>
          <FieldLabel htmlFor="reg-name">Name</FieldLabel>
          <Input id="reg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="reg-email">Email</FieldLabel>
          <Input id="reg-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          <FieldError>{errors.email}</FieldError>
        </Field>
        <Field>
          <FieldLabel htmlFor="reg-password">Password</FieldLabel>
          <Input id="reg-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
          <FieldError>{errors.password}</FieldError>
        </Field>
        <Button type="submit" size="lg" disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="text-muted-foreground text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
