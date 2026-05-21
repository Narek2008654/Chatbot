import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useApi } from "@/lib/useApi";
import * as api from "@/lib/api";

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "tok" }),
}));

vi.mock("@/lib/api", () => ({
  getChats: vi.fn().mockResolvedValue([]),
  createChat: vi.fn().mockResolvedValue({}),
  deleteChat: vi.fn().mockResolvedValue({ ok: true }),
  getMessages: vi.fn().mockResolvedValue([]),
  getMemories: vi.fn().mockResolvedValue([]),
  deleteMemory: vi.fn().mockResolvedValue({ ok: true }),
}));

describe("useApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards the current Clerk token to the api helpers", async () => {
    const { result } = renderHook(() => useApi());

    await result.current.getChats();
    expect(api.getChats).toHaveBeenCalledWith("tok");

    await result.current.createChat("My chat");
    expect(api.createChat).toHaveBeenCalledWith("tok", "My chat");

    await result.current.getMessages("chat-1");
    expect(api.getMessages).toHaveBeenCalledWith("tok", "chat-1");
  });
});
