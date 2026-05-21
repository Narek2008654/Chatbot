import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";

const TEST_EMAIL = "auth-test-user@example-test.invalid";
const TEST_PASSWORD = "password123";
const TEST_NAME = "U";

const app = createApp();

async function cleanupTestUser() {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
}

beforeEach(async () => {
  await cleanupTestUser();
});

afterAll(async () => {
  await cleanupTestUser();
  await prisma.$disconnect();
});

test("A — signup creates a user", async () => {
  const res = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

  expect(res.status).toBe(200);

  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  expect(user).not.toBeNull();
  expect(user?.email).toBe(TEST_EMAIL);
});

test("B — GET /api/me returns 401 without a session", async () => {
  const res = await request(app).get("/api/me");
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: "unauthorized" });
});

test("C — GET /api/me returns user when authenticated", async () => {
  // First sign up to create the user
  const signupRes = await request(app)
    .post("/api/auth/sign-up/email")
    .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

  expect(signupRes.status).toBe(200);

  // Extract the session cookie
  const rawCookies = signupRes.headers["set-cookie"];
  expect(rawCookies).toBeDefined();
  const cookies: string[] = Array.isArray(rawCookies)
    ? rawCookies
    : [rawCookies as string];

  const meRes = await request(app)
    .get("/api/me")
    .set("Cookie", cookies);

  expect(meRes.status).toBe(200);
  expect(meRes.body.user.email).toBe(TEST_EMAIL);
});
