import type { RequestHandler } from "express";

export const fakeAuth: RequestHandler = (req, res, next) => {
  const userId = req.header("x-test-user-id");
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};
