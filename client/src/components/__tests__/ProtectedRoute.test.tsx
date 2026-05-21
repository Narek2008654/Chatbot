import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi, describe, it, expect } from "vitest";
import { ProtectedRoute } from "@/components/ProtectedRoute";

vi.mock("@/lib/authClient", () => ({
  useSession: vi.fn(),
  signIn: {},
  signUp: {},
  signOut: vi.fn(),
  authClient: {},
}));

import { useSession } from "@/lib/authClient";

const mockUseSession = vi.mocked(useSession);

function renderWithRouter(sessionState: { data: unknown; isPending: boolean }) {
  mockUseSession.mockReturnValue({
    data: sessionState.data as ReturnType<typeof useSession>["data"],
    isPending: sessionState.isPending,
    isRefetching: false,
    error: null,
    refetch: vi.fn(),
  });

  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  it("redirects to /login when there is no session", () => {
    renderWithRouter({ data: null, isPending: false });
    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("shows loading state while session is pending", () => {
    renderWithRouter({ data: null, isPending: true });
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("renders children when session exists", () => {
    renderWithRouter({
      data: { user: { id: "1", email: "a@b.com", name: "A" }, session: {} },
      isPending: false,
    });
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
