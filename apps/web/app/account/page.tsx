import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Container } from "@/components/layout/container";
import { AccountPanels } from "@/components/account/account-panels";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  // Server-side guard. The data itself is fetched client-side through the BFF,
  // which is where the session cookie lives.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <Container className="py-16">
      <h1 className="font-heading mb-8 text-3xl font-semibold tracking-tight">Account</h1>
      <AccountPanels />
    </Container>
  );
}
