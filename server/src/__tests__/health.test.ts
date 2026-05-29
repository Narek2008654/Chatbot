import request from "supertest";
import { createTestServer } from "../test/createTestServer.js";

test("health check returns ok", async () => {
  const { express, nest } = await createTestServer();
  try {
    const res = await request(express).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  } finally {
    await nest.close();
  }
});
