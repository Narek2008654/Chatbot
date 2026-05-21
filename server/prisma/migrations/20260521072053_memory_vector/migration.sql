CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "Memory" ADD COLUMN "embedding" vector(1536);
CREATE INDEX IF NOT EXISTS memory_embedding_idx
  ON "Memory" USING hnsw ("embedding" vector_cosine_ops);
