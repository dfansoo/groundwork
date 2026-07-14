import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const apiFetch = vi.fn();
const push = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

beforeEach(() => {
  apiFetch.mockReset();
  push.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("ResetPasswordForm", () => {
  it("rejects mismatched passwords without calling the API", async () => {
    render(<ResetPasswordForm token="t1" />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "different1" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("posts the token + new password and redirects on success", async () => {
    apiFetch.mockResolvedValue({ message: "ok" });
    render(<ResetPasswordForm token="t1" />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "password1" } });
    fireEvent.change(screen.getByLabelText(/confirm/i), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("auth/reset-password", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
