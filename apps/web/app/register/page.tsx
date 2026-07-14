import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <>
      <main>
        <Container className="flex min-h-[70vh] items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-primary mb-6 text-center text-3xl font-semibold">Create your account</h1>
            <RegisterForm />
          </div>
        </Container>
      </main>
    </>
  );
}
