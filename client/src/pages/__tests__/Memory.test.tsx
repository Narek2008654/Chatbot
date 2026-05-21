import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect } from "vitest";
import { Memory } from "@/pages/Memory";

// Mock the API module
vi.mock("@/lib/api", () => ({
  getMemories: vi.fn().mockResolvedValue([
    { id: "1", content: "User likes hiking", createdAt: new Date().toISOString() },
  ]),
  deleteMemory: vi.fn().mockResolvedValue(undefined),
}));

// Mock authClient so AppHeader renders without a real session
vi.mock("@/lib/authClient", () => ({
  signOut: vi.fn(),
  signIn: {},
  signUp: {},
  useSession: vi.fn().mockReturnValue({
    data: { user: { email: "test@example.com" } },
    isPending: false,
  }),
  authClient: {},
}));

// react-router-dom: keep real impl but stub useNavigate
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => vi.fn() };
});

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Memory page", () => {
  it("renders a memory item returned by getMemories", async () => {
    render(<Memory />, { wrapper });
    expect(await screen.findByText("User likes hiking")).toBeInTheDocument();
  });
});
