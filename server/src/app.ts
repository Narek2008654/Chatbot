import express from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { env } from "./env.js";
import { auth } from "./auth.js";
import { requireAuth } from "./middleware/requireAuth.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));

  // Mount Better Auth handler BEFORE express.json() so it receives the raw body.
  // Express 5 wildcard syntax: *splat
  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/me", requireAuth, (req, res) => {
    res.json({ user: req.user });
  });

  return app;
}
