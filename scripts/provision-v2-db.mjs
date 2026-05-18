/**
 * One-off bootstrapper for v2's separate Postgres database.
 *
 * Connects to the existing Neon Postgres server using v1's
 * POSTGRES_URL_NON_POOLING, creates a fresh database called `reverse_mf_v2`
 * (if it doesn't exist), then prints the connection strings for v2.
 *
 * Usage:
 *   set NODE_TLS_REJECT_UNAUTHORIZED=0
 *   node scripts/provision-v2-db.mjs <path-to-v1-env-file>
 *
 * The env file must contain POSTGRES_URL_NON_POOLING in `KEY="value"` form
 * (this is the format `vercel env pull` produces).
 */
import fs from "node:fs";
import pkg from "pg";

const { Client } = pkg;

const NEW_DB = "reverse_mf_v2";

function loadEnv(path) {
  const lines = fs.readFileSync(path, "utf-8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    const m = /^([A-Z0-9_]+)="(.*)"$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function rewriteDbName(url, newDb) {
  // postgres://user:pass@host:port/dbname?stuff  →  ...with /newDb
  const m = /^(postgres(?:ql)?:\/\/[^/]+\/)([^?]+)(\?.*)?$/.exec(url);
  if (!m) throw new Error("Could not parse: " + url);
  return m[1] + newDb + (m[3] ?? "");
}

const envPath = process.argv[2] ?? ".env.v1";
const env = loadEnv(envPath);

const direct = env.POSTGRES_URL_NON_POOLING;
const pooled = env.POSTGRES_PRISMA_URL;

if (!direct) {
  console.error(`POSTGRES_URL_NON_POOLING missing from ${envPath}`);
  process.exit(1);
}

// Connect to the `postgres` system database so we can run CREATE DATABASE
// outside any user-created DB.
const adminUrl = rewriteDbName(direct, "postgres");

const client = new Client({ connectionString: adminUrl });

try {
  await client.connect();
  console.log(`Connected to admin DB at ${new URL(adminUrl).host}.`);

  const existing = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [NEW_DB],
  );

  if (existing.rowCount === 0) {
    console.log(`Creating database "${NEW_DB}"…`);
    await client.query(`CREATE DATABASE "${NEW_DB}"`);
    console.log(`Created "${NEW_DB}".`);
  } else {
    console.log(`Database "${NEW_DB}" already exists — skipping.`);
  }

  const newDirect = rewriteDbName(direct, NEW_DB);
  const newPooled = pooled ? rewriteDbName(pooled, NEW_DB) : newDirect;

  console.log("\n----- v2 connection strings (set on Vercel reverse-mf-v2) -----");
  console.log(`POSTGRES_URL_NON_POOLING=${newDirect}`);
  console.log(`POSTGRES_PRISMA_URL=${newPooled}`);
  console.log("---------------------------------------------------------------");

  // Persist to a tiny file so the calling shell can `vercel env add` from it.
  fs.writeFileSync(
    ".env.v2-db",
    `POSTGRES_URL_NON_POOLING="${newDirect}"\nPOSTGRES_PRISMA_URL="${newPooled}"\n`,
    "utf-8",
  );
  console.log(`\nWrote .env.v2-db (gitignored).`);
} finally {
  await client.end();
}
