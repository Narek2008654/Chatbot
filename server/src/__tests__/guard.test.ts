import request from "supertest";
import { createApp } from "../app.js";
import { createFakeAi } from "../ai/fakeAi.js";
import { fakeAuth } from "../test/fakeAuth.js";

const app = createApp({ ai: createFakeAi(), requireAuth: fakeAuth });

test("protected route returns 401 without an auth header", async () => {
  const res = await request(app).get("/api/chats");
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: "unauthorized" });
});

test("protected route passes with x-test-user-id and sets the user scope", async () => {
  const res = await request(app).get("/api/chats").set("x-test-user-id", "user_abc");
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body)).toBe(true);
});
