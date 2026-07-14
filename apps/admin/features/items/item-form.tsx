"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Field, FieldLabel, FieldError } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Textarea } from "@workspace/ui/components/textarea";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Button } from "@workspace/ui/components/button";
import { applyApiErrors } from "@/lib/form-errors";
import { createItem, updateItem, type Item } from "./api";

const schema = z.object({
  title: z.string().min(2, "Title is too short").max(200),
  description: z.string().max(5000).optional(),
  published: z.boolean().optional(),
});

type Values = z.infer<typeof schema>;

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter();
  const qc = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: item?.title ?? "",
      description: item?.description ?? "",
      published: item?.published ?? false,
    },
  });

  async function onSubmit(values: Values) {
    try {
      if (item) {
        await updateItem(item.id, values);
        toast.success("Item updated");
      } else {
        await createItem(values);
        toast.success("Item created");
      }

      // Without this the list keeps serving its cached page and the change
      // appears not to have happened.
      await qc.invalidateQueries({ queryKey: ["items"] });

      router.push("/items");
      router.refresh();
    } catch (err) {
      // Maps the API's 422 field details straight onto the form.
      if (!applyApiErrors(err, form.setError)) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-5" noValidate>
      <Field>
        <FieldLabel htmlFor="title">Title</FieldLabel>
        <Input id="title" {...form.register("title")} aria-invalid={!!form.formState.errors.title} />
        <FieldError>{form.formState.errors.title?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel htmlFor="description">Description</FieldLabel>
        <Textarea id="description" rows={5} {...form.register("description")} />
        <FieldError>{form.formState.errors.description?.message}</FieldError>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={form.watch("published")}
          onCheckedChange={(v) => form.setValue("published", v === true)}
        />
        Published
      </label>

      <div className="flex gap-3">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : item ? "Save changes" : "Create item"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/items")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
