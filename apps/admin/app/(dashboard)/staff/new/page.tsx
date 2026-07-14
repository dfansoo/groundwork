import type { Metadata } from "next";
import { StaffForm } from "@/features/staff/staff-form";

export const metadata: Metadata = { title: "Add staff" };

export default function NewStaffPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Add staff</h1>
      <StaffForm />
    </div>
  );
}
