import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { prisma } from "../../db.js";
import { createFakeAi } from "../../ai/fakeAi.js";
import { addMemory, searchMemories } from "../store.js";
import { randomUUID } from "crypto";

const USER1_ID = `test-mem-user1-${randomUUID()}`;
const USER2_ID = `test-mem-user2-${randomUUID()}`;
const USER1_EMAIL = `mem-test-user1-${Date.now()}@example.com`;
const USER2_EMAIL = `mem-test-user2-${Date.now()}@example.com`;

beforeAll(async () => {
  // Clean up any leftovers from a previous run
  await prisma.user.deleteMany({
    where: { email: { in: [USER1_EMAIL, USER2_EMAIL] } },
  });
  // Create test users
  await prisma.user.create({
    data: { id: USER1_ID, email: USER1_EMAIL, name: "Test User 1" },
  });
  await prisma.user.create({
    data: { id: USER2_ID, email: USER2_EMAIL, name: "Test User 2" },
  });
});

afterAll(async () => {
  // Cascade deletes memories too
  await prisma.user.deleteMany({
    where: { email: { in: [USER1_EMAIL, USER2_EMAIL] } },
  });
  await prisma.$disconnect();
});

describe("addMemory + searchMemories", () => {
  it("stores a memory and retrieves it for the correct user", async () => {
    const ai = createFakeAi();
    await addMemory(ai, USER1_ID, "User likes hiking");
    const results = await searchMemories(ai, USER1_ID, "outdoors", 5);
    expect(results).toContain("User likes hiking");
  });

  it("scopes memories per user — user2 memory not visible to user1", async () => {
    const ai = createFakeAi();
    await addMemory(ai, USER2_ID, "User2 secret fact");
    const user1Results = await searchMemories(ai, USER1_ID, "secret", 5);
    expect(user1Results).not.toContain("User2 secret fact");
    const user2Results = await searchMemories(ai, USER2_ID, "secret", 5);
    expect(user2Results).toContain("User2 secret fact");
  });
});
