import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const bffFetch = vi.fn();
const signOut = vi.fn();
vi.mock("@/lib/api/bff", () => ({ bffFetch: (...a: unknown[]) => bffFetch(...a) }));
vi.mock("next-auth/react", () => ({ signOut: (...a: unknown[]) => signOut(...a) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ApiError } from "@/lib/api/public";

const fill = (current: string, next: string, confirm: string) => {
  fireEvent.change(screen.getByLabelText(/current password/i), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: next } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
};

const submit = () => fireEvent.click(screen.getByRole("button", { name: /change password/i }));

beforeEach(() => {
  bffFetch.mockReset();
  signOut.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("ChangePasswordForm", () => {
  it("rejects mismatched passwords without calling the API", async () => {
    render(<ChangePasswordForm />);
    fill("OldPass123!", "NewPass123!", "Different123!");
    submit();

    expect(await screen.findByText(/don't match/i)).toBeInTheDocument();
    expect(bffFetch).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password without calling the API", async () => {
    render(<ChangePasswordForm />);
    fill("SamePass123!", "SamePass123!", "SamePass123!");
    submit();

    expect(await screen.findByText(/different from your current one/i)).toBeInTheDocument();
    expect(bffFetch).not.toHaveBeenCalled();
  });

  it("rejects a short new password", async () => {
    render(<ChangePasswordForm />);
    fill("OldPass123!", "short", "short");
    submit();

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(bffFetch).not.toHaveBeenCalled();
  });

  it("posts the change and signs out — the API has revoked this session too", async () => {
    bffFetch.mockResolvedValue({ message: "Your password has been updated." });
    render(<ChangePasswordForm />);
    fill("OldPass123!", "NewPass123!", "NewPass123!");
    submit();

    await waitFor(() =>
      expect(bffFetch).toHaveBeenCalledWith(
        "auth/change-password",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const init = bffFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({
      currentPassword: "OldPass123!",
      newPassword: "NewPass123!",
    });

    // Staying on the page would leave a dead token in the cookie, and every
    // subsequent request would 401 for no visible reason.
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it("puts a 401 on the current-password field, where the user can act on it", async () => {
    bffFetch.mockRejectedValue(new ApiError(401, "Your current password is incorrect"));
    render(<ChangePasswordForm />);
    fill("WrongPass123!", "NewPass123!", "NewPass123!");
    submit();

    expect(await screen.findByText(/not your current password/i)).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("surfaces a rate limit rather than a generic failure", async () => {
    bffFetch.mockRejectedValue(new ApiError(429, "Too many requests"));
    render(<ChangePasswordForm />);
    fill("OldPass123!", "NewPass123!", "NewPass123!");
    submit();

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });
});
