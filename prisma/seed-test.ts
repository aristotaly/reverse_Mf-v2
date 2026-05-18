import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { buildDailySeries, normalizeDate, toDateKey } from "../utils/analytics";

const prisma = new PrismaClient();

export type SeedMode = "default" | "ewma" | "gap" | "macrofactor";

/** Fixed "today" for deterministic Playwright assertions */
export const TEST_TODAY = new Date("2026-05-18T00:00:00.000Z");

export async function seedTestUser(mode: SeedMode = "default") {
  const passcode = process.env.SEED_PASSCODE ?? "1234";
  const username = (process.env.SEED_USERNAME ?? "admin").toLowerCase();
  const hash = await bcrypt.hash(passcode, 10);

  await prisma.weightEntry.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      id: "test-user",
      username,
      name: "Test",
      passcodeHash: hash,
    },
  });

  if (mode === "ewma") {
    const entries = [
      { daysAgo: 10, weight: 100 },
      { daysAgo: 5, weight: 90 },
      { daysAgo: 0, weight: 95 },
    ];
    for (const e of entries) {
      const date = new Date(TEST_TODAY);
      date.setUTCDate(date.getUTCDate() - e.daysAgo);
      await prisma.weightEntry.create({
        data: {
          userId: user.id,
          date: normalizeDate(date),
          weight: e.weight,
        },
      });
    }
    return user;
  }

  if (mode === "gap") {
    const entries = [
      { daysAgo: 10, weight: 94 },
      { daysAgo: 6, weight: 96 },
      { daysAgo: 0, weight: 95 },
    ];
    for (const e of entries) {
      const date = new Date(TEST_TODAY);
      date.setUTCDate(date.getUTCDate() - e.daysAgo);
      await prisma.weightEntry.create({
        data: {
          userId: user.id,
          date: normalizeDate(date),
          weight: e.weight,
        },
      });
    }
    return user;
  }

  if (mode === "macrofactor") {
    const dataPath = path.join(
      process.cwd(),
      "scripts",
      "macrofactor-logged.json",
    );
    const data = JSON.parse(fs.readFileSync(dataPath, "utf-8")) as {
      entries: { date: string; weight: number }[];
    };
    // Bulk-insert 443 entries efficiently
    const records = data.entries.map((e) => {
      const [y, m, d] = e.date.split("-").map((s) => parseInt(s, 10));
      return {
        userId: user.id,
        date: normalizeDate(new Date(Date.UTC(y, m - 1, d))),
        weight: e.weight,
      };
    });
    // SQLite/Prisma: createMany is supported for SQLite in Prisma 6
    await prisma.weightEntry.createMany({ data: records });
    return user;
  }

  for (let i = 0; i < 14; i++) {
    const date = new Date(TEST_TODAY);
    date.setUTCDate(date.getUTCDate() - i);
    await prisma.weightEntry.create({
      data: {
        userId: user.id,
        date: normalizeDate(date),
        weight: 95 + (i % 3) * 0.5,
      },
    });
  }

  return user;
}

export function expectedTrendForEwmaTest() {
  const entries = [
    { date: normalizeDate(new Date("2026-05-08T00:00:00.000Z")), weight: 100 },
    { date: normalizeDate(new Date("2026-05-13T00:00:00.000Z")), weight: 90 },
    { date: normalizeDate(TEST_TODAY), weight: 95 },
  ];
  const points = buildDailySeries(entries, TEST_TODAY);
  const byKey = Object.fromEntries(
    points.map((p) => [toDateKey(p.date), p.trendRounded]),
  );
  return byKey;
}

const mode = (process.argv[2] as SeedMode) ?? "default";
seedTestUser(mode)
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
