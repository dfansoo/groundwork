import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

import { AccountMenu } from "@/components/auth/account-menu";

describe("AccountMenu", () => {
  it("shows a Sign in link when signed out", () => {
    render(<AccountMenu user={null} />);
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute("href", "/login");
  });

  it("shows the account trigger with the user's initials when signed in", () => {
    render(<AccountMenu user={{ name: "Jan Kowalski", email: "jan@x.com", avatar: null }} />);
    expect(screen.getByText("JK")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
  });
});
