import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const signIn = vi.fn();
const apiFetch = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...a: unknown[]) => signIn(...a) }));
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { RegisterForm } from "@/components/auth/register-form";

beforeEach(() => {
  signIn.mockReset();
  apiFetch.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("RegisterForm", () => {
  it("registers then signs in on valid input", async () => {
    apiFetch.mockResolvedValue({ user: { id: "u1" } });
    signIn.mockResolvedValue({ ok: true, error: null });
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Jan Kowalski" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jan@x.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("auth/register", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith("credentials", expect.objectContaining({ email: "jan@x.com", password: "password1", redirect: false })),
    );
  });

  it("blocks a name with digits and never calls the API", async () => {
    render(<RegisterForm />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Jan3" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jan@x.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));
    expect(await screen.findByText(/letters/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
