import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { createFakeAi } from "../ai/fakeAi.js";
import { fakeAuth } from "../test/fakeAuth.js";

const app = createApp({ ai: createFakeAi(), requireAuth: fakeAuth });

const USER1 = "user_test_chats_1";
const USER2 = "user_test_chats_2";

async function cleanup() {
  await prisma.chat.deleteMany({ where: { userId: { in: [USER1, USER2] } } });
}

beforeAll(cleanup);

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

test("POST /api/chats creates a chat and returns id + title", async () => {
  const res = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "My First Chat" });

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ title: "My First Chat" });
  expect(res.body.id).toBeDefined();
  expect(res.body.createdAt).toBeDefined();
  expect(res.body.updatedAt).toBeDefined();
});

test("POST /api/chats uses default title when none provided", async () => {
  const res = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({});

  expect(res.status).toBe(200);
  expect(res.body.title).toBe("New chat");
});

test("GET /api/chats lists the user's chats newest first", async () => {
  const r1 = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Chat A" });
  const r2 = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Chat B" });

  const res = await request(app).get("/api/chats").set("x-test-user-id", USER1);

  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
  const ids = res.body.map((c: { id: string }) => c.id);
  expect(ids).toContain(r1.body.id);
  expect(ids).toContain(r2.body.id);
  // newest first — r2 was created after r1
  expect(ids.indexOf(r2.body.id)).toBeLessThan(ids.indexOf(r1.body.id));
});

test("GET /api/chats/:id returns the chat for its owner", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Owner Chat" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .get(`/api/chats/${chatId}`)
    .set("x-test-user-id", USER1);

  expect(res.status).toBe(200);
  expect(res.body.id).toBe(chatId);
});

test("GET /api/chats/:id returns 404 for another user's chat", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Private Chat" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .get(`/api/chats/${chatId}`)
    .set("x-test-user-id", USER2);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "not found" });

  // Row still exists
  const row = await prisma.chat.findUnique({ where: { id: chatId } });
  expect(row).not.toBeNull();
});

test("DELETE /api/chats/:id by another user returns 404 and row remains", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Delete Target" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .delete(`/api/chats/${chatId}`)
    .set("x-test-user-id", USER2);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "not found" });

  const row = await prisma.chat.findUnique({ where: { id: chatId } });
  expect(row).not.toBeNull();
});

test("DELETE /api/chats/:id by owner removes the chat", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "To Be Deleted" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .delete(`/api/chats/${chatId}`)
    .set("x-test-user-id", USER1);

  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });

  const row = await prisma.chat.findUnique({ where: { id: chatId } });
  expect(row).toBeNull();
});

test("GET /api/chats/:id/messages on a new chat returns empty array", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Empty Chat" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .get(`/api/chats/${chatId}/messages`)
    .set("x-test-user-id", USER1);

  expect(res.status).toBe(200);
  expect(res.body).toEqual([]);
});

test("GET /api/chats/:id/messages returns 404 for another user's chat", async () => {
  const createRes = await request(app)
    .post("/api/chats")
    .set("x-test-user-id", USER1)
    .send({ title: "Another Private Chat" });
  const chatId = createRes.body.id;

  const res = await request(app)
    .get(`/api/chats/${chatId}/messages`)
    .set("x-test-user-id", USER2);

  expect(res.status).toBe(404);
  expect(res.body).toEqual({ error: "not found" });
});
