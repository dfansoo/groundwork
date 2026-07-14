import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <main>
        <Container className="flex min-h-[70vh] items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="mb-6 text-center font-serif text-3xl font-semibold text-primary">
              Reset your password
            </h1>
            <ForgotPasswordForm />
          </div>
        </Container>
      </main>
    </>
  );
}
