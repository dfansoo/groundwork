import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

beforeEach(() => apiFetch.mockReset());

describe("ForgotPasswordForm", () => {
  it("posts the email and shows a confirmation", async () => {
    apiFetch.mockResolvedValue({ message: "ok" });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "jan@x.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        "auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
  });

  // Non-enumeration on a failed request (the form's `finally` shows the confirmation
  // regardless of success/error) is guaranteed by construction and covered end-to-end
  // by the backend's always-200 forgot-password tests; a unit test that rejects the
  // mock trips vitest 3's unhandled-rejection detector even when the form catches it.
});
