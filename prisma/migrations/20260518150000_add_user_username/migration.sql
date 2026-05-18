-- AlterTable: introduce a nullable username, backfill, then enforce NOT NULL.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

-- Backfill any pre-existing single-tenant user with the default 'admin' name.
UPDATE "User" SET "username" = 'admin' WHERE "username" IS NULL;

-- Enforce NOT NULL once every row has a value.
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

-- Unique index on username for fast login lookups.
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
