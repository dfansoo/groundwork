"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Button } from "@workspace/ui/components/button";
import { applyApiErrors } from "@/lib/form-errors";
import type { Role } from "@/lib/permissions";
import { RoleCheckboxes } from "./role-checkboxes";
import { createStaff } from "./api";

const ROLES = ["SUPER_ADMIN", "ADMIN", "EDITOR", "VIEWER", "USER"] as const;

const schema = z.object({
  email: z.email("Enter a valid email address"),
  username: z.string().min(2, "Name is too short").max(100),
  password: z.string().min(8, "Use at least 8 characters"),
  roles: z.array(z.enum(ROLES)).min(1, "Pick at least one role"),
});

type Values = z.infer<typeof schema>;

export function StaffForm() {
  const router = useRouter();
  const qc = useQueryClient();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", username: "", password: "", roles: ["VIEWER"] },
  });

  async function onSubmit(values: Values) {
    try {
      await createStaff({ ...values, roles: values.roles as Role[] });
      toast.success(`Added ${values.username}`);
      await qc.invalidateQueries({ queryKey: ["staff"] });
      router.push("/staff");
      router.refresh();
    } catch (err) {
      if (!applyApiErrors(err, form.setError)) {
        toast.error(err instanceof Error ? err.message : "Could not add that person");
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-5" noValidate>
      <Field>
        <FieldLabel htmlFor="username">Name</FieldLabel>
        <Input
          id="username"
          {...form.register("username")}
          aria-invalid={!!form.formState.errors.username}
        />
        <FieldError>{form.formState.errors.username?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          {...form.register("email")}
          aria-invalid={!!form.formState.errors.email}
        />
        <FieldError>{form.formState.errors.email?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="password">Temporary password</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...form.register("password")}
          aria-invalid={!!form.formState.errors.password}
        />
        <FieldError>{form.formState.errors.password?.message}</FieldError>
        <p className="text-xs text-muted-foreground">
          They can change it from their account page once they sign in.
        </p>
      </Field>

      <Field>
        <FieldLabel>Roles</FieldLabel>
        <Controller
          control={form.control}
          name="roles"
          render={({ field }) => (
            <RoleCheckboxes
              value={field.value as Role[]}
              onChange={(roles) => field.onChange(roles)}
              disabled={form.formState.isSubmitting}
            />
          )}
        />
        <FieldError>{form.formState.errors.roles?.message}</FieldError>
      </Field>

      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Adding…" : "Add staff member"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/staff")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
