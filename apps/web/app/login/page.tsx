import type { Metadata } from "next";
import { Container } from "@/components/layout/container";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const { callbackUrl } = await searchParams;
  return (
    <>
      <main>
        <Container className="flex min-h-[70vh] items-center justify-center py-16">
          <div className="w-full max-w-sm">
            <h1 className="font-serif text-primary mb-6 text-center text-3xl font-semibold">Welcome back</h1>
            <LoginForm callbackUrl={callbackUrl || "/account"} />
          </div>
        </Container>
      </main>
    </>
  );
}
