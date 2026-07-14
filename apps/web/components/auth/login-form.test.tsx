import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...a: unknown[]) => signIn(...a) }));

import { LoginForm } from "@/components/auth/login-form";

beforeEach(() => signIn.mockReset());

describe("LoginForm", () => {
  it("shows a validation error for a bad email and does not call signIn", async () => {
    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "nope" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("calls signIn('credentials') with the entered values", async () => {
    signIn.mockResolvedValue({ ok: true, error: null });
    render(<LoginForm callbackUrl="/account" />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jan@x.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ email: "jan@x.com", password: "password1", redirect: false }),
      ),
    );
  });
});
