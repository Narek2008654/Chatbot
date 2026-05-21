import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Signup } from "@/pages/Signup";
import { signUp } from "@/lib/authClient";

const mockNavigate = vi.fn();

vi.mock("@/lib/authClient", () => ({
  signUp: {
    email: vi.fn(),
  },
  signIn: {},
  signOut: vi.fn(),
  useSession: vi.fn().mockReturnValue({
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  authClient: {},
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignUpEmail = vi.mocked(signUp.email);

describe("Signup page", () => {
  beforeEach(() => {
    mockSignUpEmail.mockReset();
    mockNavigate.mockReset();
    mockSignUpEmail.mockResolvedValue({ data: { user: {} }, error: null } as Awaited<ReturnType<typeof signUp.email>>);
  });

  it("calls signUp.email with name, email, and password on submit", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mockSignUpEmail).toHaveBeenCalledWith({
      name: "Alice",
      email: "alice@example.com",
      password: "secret123",
    });
  });

  it("navigates to / on successful signup", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/name/i), "Alice");
    await user.type(screen.getByLabelText(/email/i), "alice@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");

    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
