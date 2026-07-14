import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <main>
        <Container className="flex min-h-[70vh] items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-primary">
              Set a new password
            </h1>
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                This reset link is missing or invalid.{" "}
                <Link href="/forgot-password" className="text-primary hover:underline">
                  Request a new one
                </Link>
                .
              </p>
            )}
          </div>
        </Container>
      </main>
    </>
  );
}
