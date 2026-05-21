import { Router } from "express";
import { prisma } from "../db.js";

export function createMemoryRouter(): Router {
  const router = Router();

  // GET / — list user's memories, newest first
  router.get("/", async (req, res) => {
    const memories = await prisma.memory.findMany({
      where: { userId: req.userId! },
      select: { id: true, content: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(memories);
  });

  // DELETE /:id — delete if owned, else 404
  router.delete("/:id", async (req, res) => {
    const result = await prisma.memory.deleteMany({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (result.count === 0) {
      res.status(404).json({ error: "not found" });
      return;
    }

    res.json({ ok: true });
  });

  return router;
}
