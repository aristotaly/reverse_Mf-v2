/**
 * Import MacroFactor Scale Weight export and compare trends.
 * Usage: npx tsx scripts/import-macrofactor.ts <path-to-xlsx>
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  buildDailySeries,
  normalizeDate,
  toDateKey,
} from "../utils/analytics";

const prisma = new PrismaClient();

type Row = {
  date: Date;
  scale: number;
  mfTrend: number;
};

function excelToDate(value: unknown): Date | null {
  // xlsx with cellDates:true returns a Date in LOCAL time (midnight local).
  // We must extract the calendar Y/M/D from local time and rebuild a UTC
  // midnight Date so the calendar day isn't shifted by the local timezone.
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    // Excel serial date → JS UTC date (already UTC-aligned)
    const utcMs = Math.round((value - 25569) * 86400 * 1000);
    return new Date(utcMs);
  }
  // Treat ISO/yyyy-mm-dd strings as a calendar date in UTC
  const str = String(value).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoMatch) {
    return new Date(
      Date.UTC(
        parseInt(isoMatch[1], 10),
        parseInt(isoMatch[2], 10) - 1,
        parseInt(isoMatch[3], 10),
      ),
    );
  }
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()),
  );
}

function parseWorkbook(filePath: string): Row[] {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets["Scale Weight"] ?? wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  const rows: Row[] = [];
  for (const r of raw) {
    const dateVal = r["Date"];
    const weight = r["Weight (kg)"];
    const trend = r["Trend Weight (kg)"];
    if (dateVal == null || weight == null || trend == null) continue;

    const weightNum =
      typeof weight === "number" ? weight : parseFloat(String(weight));
    const trendNum =
      typeof trend === "number" ? trend : parseFloat(String(trend));
    if (Number.isNaN(weightNum) || Number.isNaN(trendNum)) continue;

    const date = excelToDate(dateVal);
    if (!date) continue;

    rows.push({
      date: normalizeDate(date),
      scale: weightNum,
      mfTrend: trendNum,
    });
  }

  return rows.sort((a, b) => a.date.getTime() - b.date.getTime());
}

async function ensureUser() {
  const passcode = process.env.SEED_PASSCODE ?? "1234";
  const name = process.env.SEED_USER_NAME ?? "Admin";
  const username = (process.env.SEED_USERNAME ?? "admin").toLowerCase();
  const hash = await bcrypt.hash(passcode, 10);

  return prisma.user.upsert({
    where: { id: "seed-user" },
    update: { name, username, passcodeHash: hash },
    create: { id: "seed-user", name, username, passcodeHash: hash },
  });
}

async function importWeights(userId: string, rows: Row[], reset: boolean) {
  if (reset) {
    const deleted = await prisma.weightEntry.deleteMany({ where: { userId } });
    console.log(`Deleted ${deleted.count} pre-existing entries for user.`);
  }
  let count = 0;
  for (const row of rows) {
    await prisma.weightEntry.upsert({
      where: { userId_date: { userId, date: row.date } },
      create: { userId, date: row.date, weight: row.scale },
      update: { weight: row.scale },
    });
    count++;
  }
  return count;
}

function compareTrends(rows: Row[], today: Date) {
  const entries = rows.map((r) => ({ date: r.date, weight: r.scale }));
  const series = buildDailySeries(entries, today);
  const ourByDate = new Map(series.map((p) => [toDateKey(p.date), p]));

  const comparisons: {
    date: string;
    scale: number;
    ours: number;
    mf: number;
    diff: number;
  }[] = [];

  for (const row of rows) {
    const key = toDateKey(row.date);
    const point = ourByDate.get(key);
    if (!point) continue;
    const ours = Math.round(point.trend * 100) / 100;
    const mf = Math.round(row.mfTrend * 100) / 100;
    comparisons.push({
      date: key,
      scale: row.scale,
      ours,
      mf,
      diff: Math.round((ours - mf) * 100) / 100,
    });
  }

  const absDiffs = comparisons.map((c) => Math.abs(c.diff));
  const meanAbs =
    absDiffs.reduce((a, b) => a + b, 0) / (absDiffs.length || 1);
  const maxAbs = Math.max(...absDiffs, 0);
  const within01 = absDiffs.filter((d) => d <= 0.1).length;
  const within05 = absDiffs.filter((d) => d <= 0.5).length;

  const last = comparisons[comparisons.length - 1];
  const first = comparisons[0];

  return {
    comparisons,
    stats: {
      count: comparisons.length,
      meanAbsError: Math.round(meanAbs * 1000) / 1000,
      maxAbsError: Math.round(maxAbs * 100) / 100,
      within01,
      within05,
      first,
      last,
      ourTrendDelta:
        last && first
          ? Math.round((last.ours - first.ours) * 10) / 10
          : 0,
      mfTrendDelta:
        last && first
          ? Math.round((last.mf - first.mf) * 10) / 10
          : 0,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const filePath =
    args.find((a) => !a.startsWith("--")) ??
    path.join(
      process.env.USERPROFILE ?? "",
      "Downloads",
      "MacroFactor-20260518132238.xlsx.xlsx",
    );

  if (!fs.existsSync(filePath)) {
    console.error("File not found:", filePath);
    process.exit(1);
  }

  const rows = parseWorkbook(filePath);
  console.log(`Parsed ${rows.length} scale weight entries.`);
  console.log(
    `Date range: ${toDateKey(rows[0].date)} → ${toDateKey(rows[rows.length - 1].date)}`,
  );
  console.log(
    `Sample first 3: ${rows
      .slice(0, 3)
      .map((r) => `${toDateKey(r.date)}=${r.scale}`)
      .join(", ")}`,
  );
  console.log(
    `Sample last 3: ${rows
      .slice(-3)
      .map((r) => `${toDateKey(r.date)}=${r.scale}`)
      .join(", ")}`,
  );

  const user = await ensureUser();
  const imported = await importWeights(user.id, rows, reset);
  console.log(`Imported/updated ${imported} entries for user "${user.name}".`);

  const today = normalizeDate(rows[rows.length - 1].date);
  const { stats, comparisons } = compareTrends(rows, today);

  console.log("\n--- Trend comparison (our EWMA α=0.1 vs MacroFactor) ---");
  console.log(`Compared on ${stats.count} logged days`);
  console.log(`Mean absolute error: ${stats.meanAbsError} kg`);
  console.log(`Max absolute error: ${stats.maxAbsError} kg`);
  console.log(`Within 0.1 kg: ${stats.within01}/${stats.count}`);
  console.log(`Within 0.5 kg: ${stats.within05}/${stats.count}`);
  console.log(
    `\nOverall trend change (${toDateKey(rows[0].date)} → ${toDateKey(rows[rows.length - 1].date)}):`,
  );
  console.log(`  Ours: ${stats.ourTrendDelta} kg`);
  console.log(`  MacroFactor: ${stats.mfTrendDelta} kg`);
  console.log(`\nLatest day ${stats.last?.date}:`);
  console.log(
    `  Scale ${stats.last?.scale} kg | Our trend ${stats.last?.ours} | MF trend ${stats.last?.mf} | Δ ${stats.last?.diff} kg`,
  );

  const outPath = path.join(process.cwd(), "macrofactor-comparison.csv");
  const csv = [
    "date,scale_kg,our_trend_kg,mf_trend_kg,diff_kg",
    ...comparisons.map(
      (c) => `${c.date},${c.scale},${c.ours},${c.mf},${c.diff}`,
    ),
  ].join("\n");
  fs.writeFileSync(outPath, csv);
  console.log(`\nWrote comparison CSV: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
