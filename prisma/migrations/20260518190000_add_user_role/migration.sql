-- AddColumn: User.role (nullable first, backfill, then NOT NULL with default)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT;

-- Backfill: the seed admin user (if present) gets the admin role; everyone else stays a regular user.
UPDATE "User" SET "role" = 'admin' WHERE "username" = 'admin' AND "role" IS NULL;
UPDATE "User" SET "role" = 'user' WHERE "role" IS NULL;

-- Lock in default + NOT NULL.
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'user';
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
