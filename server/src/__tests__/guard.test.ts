import request from "supertest";
import type { Express } from "express";
import type { INestApplication } from "@nestjs/common";
import { createTestServer } from "../test/createTestServer.js";
import { createFakeAi } from "../ai/fakeAi.js";
import { fakeAuth } from "../test/fakeAuth.js";

let app: Express;
let nest: INestApplication;

beforeAll(async () => {
  ({ express: app, nest } = await createTestServer({ ai: createFakeAi(), requireAuth: fakeAuth }));
});

afterAll(async () => {
  await nest.close();
});

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
