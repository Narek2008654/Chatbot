-- Drop Foreign Keys from Chat and Memory to User
ALTER TABLE "Chat" DROP CONSTRAINT IF EXISTS "Chat_userId_fkey";
ALTER TABLE "Memory" DROP CONSTRAINT IF EXISTS "Memory_userId_fkey";

-- Drop Better Auth tables
DROP TABLE IF EXISTS "verification";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "user";
