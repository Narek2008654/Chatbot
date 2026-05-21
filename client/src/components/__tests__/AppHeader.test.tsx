import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppHeader } from "../AppHeader";

vi.mock("@/lib/authClient", () => ({
  useSession: () => ({ data: { user: { email: "user@example.com" } } }),
  signOut: vi.fn(),
}));

describe("AppHeader", () => {
  it("opens the user menu without crashing and shows the email + sign out", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppHeader navLink={{ to: "/memory", label: "Memory" }} />
      </MemoryRouter>
    );

    // Opening the menu renders the email label; this used to throw a
    // "MenuGroupContext is missing" error when the label wasn't inside a group.
    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });
});
