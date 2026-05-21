import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../auth.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
      session?: {
        id: string;
        userId: string;
        expiresAt: Date;
        createdAt: Date;
        updatedAt: Date;
        token: string;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  req.user = session.user;
  req.session = session.session;
  next();
}
