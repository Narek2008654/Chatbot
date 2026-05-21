import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";

export const clerkAuth: RequestHandler = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  req.userId = userId;
  next();
};
