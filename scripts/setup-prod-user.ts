/**
 * Apply the username migration to Vercel Postgres (idempotent) and set the
 * production credentials to admin / Amdocs101.
 *
 * Usage:
 *   set NODE_TLS_REJECT_UNAUTHORIZED=0
 *   npx tsx scripts/setup-prod-user.ts
 *
 * Requires POSTGRES_PRISMA_URL (and friends) in the env, loaded from
 * .env.local.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_USERNAME = process.env.PROD_USERNAME ?? "admin";
const TARGET_PASSWORD = process.env.PROD_PASSWORD ?? "Amdocs101";
const TARGET_NAME = process.env.PROD_USER_NAME ?? "Admin";

async function main() {
  // 1. Run the column migration in an idempotent way. This mirrors the SQL
  // in prisma/migrations/20260518150000_add_user_username/migration.sql so we
  // can apply it without relying on `prisma migrate deploy` being run yet.
  console.log("Ensuring 'username' column exists on User table...");
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT',
  );

  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "username" = $1 WHERE "username" IS NULL`,
    TARGET_USERNAME.toLowerCase(),
  );

  // Make sure it is NOT NULL (no-op if already).
  await prisma.$executeRawUnsafe(
    'ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL',
  );

  // Add the unique index if missing.
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")',
  );

  console.log("Column + unique index OK.");

  // 2. Upsert the production credentials on the existing seed-user.
  const hash = await bcrypt.hash(TARGET_PASSWORD, 10);
  const updated = await prisma.user.upsert({
    where: { id: "seed-user" },
    update: {
      username: TARGET_USERNAME.toLowerCase(),
      name: TARGET_NAME,
      passcodeHash: hash,
    },
    create: {
      id: "seed-user",
      username: TARGET_USERNAME.toLowerCase(),
      name: TARGET_NAME,
      passcodeHash: hash,
    },
  });

  console.log(
    `User updated:`,
    `id=${updated.id} username=${updated.username} name=${updated.name}`,
  );
  console.log(
    `\nCredentials: ${TARGET_USERNAME} / ${TARGET_PASSWORD} (stored as bcrypt hash)`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
