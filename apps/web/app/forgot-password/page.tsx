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
            <h1 className="font-serif text-primary mb-6 text-center text-3xl font-semibold">Reset your password</h1>
            <ForgotPasswordForm />
          </div>
        </Container>
      </main>
    </>
  );
}
