import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { createFakeAi } from "../ai/fakeAi.js";
import { fakeAuth } from "../test/fakeAuth.js";

const app = createApp({ ai: createFakeAi(), requireAuth: fakeAuth });

const USER1 = "user_test_stream_1";
const USER2 = "user_test_stream_2";

let chatId: string;

async function cleanup() {
  await prisma.chat.deleteMany({ where: { userId: { in: [USER1, USER2] } } });
}

beforeAll(async () => {
  await cleanup();
  const chatRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Stream Test Chat" });
  chatId = chatRes.body.id;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("POST /api/chats/:id/stream returns text/event-stream with fake AI chunks and done event", async () => {
  const res = await request(app)
    .post(`/api/chats/${chatId}/stream`)
    .set("x-test-user-id", USER1)
    .send({ content: "hi" });

  expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
  expect(res.text).toContain("Hello");
  expect(res.text).toContain(" from");
  expect(res.text).toContain("event: done");
});

test("POST /api/chats/:id/stream saves user and assistant messages in DB", async () => {
  // Create a fresh chat to isolate message counts
  const chatRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Message Count Chat" });
  const isolatedChatId = chatRes.body.id;

  await request(app)
    .post(`/api/chats/${isolatedChatId}/stream`)
    .set("x-test-user-id", USER1)
    .send({ content: "hi" });

  const msgs = await prisma.message.findMany({
    where: { chatId: isolatedChatId },
    orderBy: { createdAt: "asc" },
  });

  expect(msgs).toHaveLength(2);
  expect(msgs[0].role).toBe("user");
  expect(msgs[0].content).toBe("hi");
  expect(msgs[1].role).toBe("assistant");
  expect(msgs[1].content).toBe("Hello from the fake AI.");
});

test("POST /api/chats/:id/stream generates a title from the first message", async () => {
  // A dedicated app whose fake AI returns a deterministic title for `complete`.
  const titledApp = createApp({
    ai: createFakeAi({ complete: async () => "Cats and Dogs" }),
    requireAuth: fakeAuth,
  });

  const chatRes = await request(titledApp)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "New chat" });
  const newChatId = chatRes.body.id;

  await request(titledApp)
    .post(`/api/chats/${newChatId}/stream`)
    .set("x-test-user-id", USER1)
    .send({ content: "tell me about cats and dogs" });

  const chat = await prisma.chat.findUnique({ where: { id: newChatId } });
  expect(chat?.title).toBe("Cats and Dogs");
});

test("POST /api/chats/:id/stream does not change the title on later turns", async () => {
  const titledApp = createApp({
    ai: createFakeAi({ complete: async () => "Generated Title" }),
    requireAuth: fakeAuth,
  });

  const chatRes = await request(titledApp)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "New chat" });
  const newChatId = chatRes.body.id;

  // First turn sets the title.
  await request(titledApp)
    .post(`/api/chats/${newChatId}/stream`)
    .set("x-test-user-id", USER1)
    .send({ content: "first message" });
  const afterFirst = await prisma.chat.findUnique({ where: { id: newChatId } });
  expect(afterFirst?.title).toBe("Generated Title");

  // Second turn must NOT regenerate/overwrite it.
  await request(titledApp)
    .post(`/api/chats/${newChatId}/stream`)
    .set("x-test-user-id", USER1)
    .send({ content: "second message" });
  const afterSecond = await prisma.chat.findUnique({ where: { id: newChatId } });
  expect(afterSecond?.title).toBe("Generated Title");
});

test("POST /api/chats/:id/stream returns 404 when another user streams to user1's chat", async () => {
  const res = await request(app)
    .post(`/api/chats/${chatId}/stream`)
    .set("x-test-user-id", USER2)
    .send({ content: "sneaky" });

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "not found" });
});
