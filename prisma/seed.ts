import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { normalizeDate } from "../utils/analytics";

const prisma = new PrismaClient();

const SAMPLE_WEIGHTS = [
  96.7, 96.0, 95.8, 96.1, 95.5, 95.2, 94.8, 95.0, 94.6, 95.1, 96.0, 96.7,
  96.1, 95.3, 95.0, 94.0, 96.0, 94.6, 95.1, 96.1, 96.7, 96.0, 95.8, 95.5,
  95.2, 94.8, 95.0, 94.6, 95.0, 94.0,
];

async function main() {
  const name = process.env.SEED_USER_NAME ?? "Admin";
  const username = (process.env.SEED_USERNAME ?? "admin").toLowerCase();
  const passcode = process.env.SEED_PASSCODE ?? "1234";
  const hash = await bcrypt.hash(passcode, 10);

  const user = await prisma.user.upsert({
    where: { id: "seed-user" },
    update: { name, username, passcodeHash: hash },
    create: {
      id: "seed-user",
      name,
      username,
      passcodeHash: hash,
    },
  });

  const today = normalizeDate(new Date());

  for (let i = 0; i < SAMPLE_WEIGHTS.length; i++) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    const normalized = normalizeDate(date);
    await prisma.weightEntry.upsert({
      where: {
        userId_date: { userId: user.id, date: normalized },
      },
      update: { weight: SAMPLE_WEIGHTS[i] },
      create: {
        userId: user.id,
        date: normalized,
        weight: SAMPLE_WEIGHTS[i],
      },
    });
  }

  console.log(`Seeded user "${name}" with ${SAMPLE_WEIGHTS.length} weight entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
