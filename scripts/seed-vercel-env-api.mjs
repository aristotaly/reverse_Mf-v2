/**
 * Sets the v2 Vercel env vars by calling Vercel's REST API directly.
 *
 * The Windows CLI seems to silently store empty strings for production env
 * vars when stdin redirection is used, so we sidestep the CLI entirely.
 *
 * Requirements:
 *   - .vercel/project.json (projectId + orgId) — created by `vercel link`
 *   - .env.v2-db (POSTGRES_PRISMA_URL + POSTGRES_URL_NON_POOLING from
 *     scripts/provision-v2-db.mjs)
 *   - Vercel CLI auth token at
 *     %APPDATA%/xdg.data/com.vercel.cli/auth.json
 */
import fs from "node:fs";
import path from "node:path";
import https from "node:https";

function loadEnvFile(p) {
  const out = {};
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)="(.*)"$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const project = JSON.parse(fs.readFileSync(".vercel/project.json", "utf-8"));
const dbEnv = loadEnvFile(".env.v2-db");

const authPath = path.join(
  process.env.APPDATA ?? "",
  "xdg.data",
  "com.vercel.cli",
  "auth.json",
);
const { token } = JSON.parse(fs.readFileSync(authPath, "utf-8"));

const sessionSecret = Array.from({ length: 48 }, () =>
  "abcdef0123456789"[Math.floor(Math.random() * 16)],
).join("");

const vars = [
  { key: "POSTGRES_URL_NON_POOLING", value: dbEnv.POSTGRES_URL_NON_POOLING },
  { key: "POSTGRES_PRISMA_URL", value: dbEnv.POSTGRES_PRISMA_URL },
  { key: "SESSION_SECRET", value: sessionSecret },
  { key: "SEED_PASSCODE", value: "Amdocs101" },
  { key: "SEED_USERNAME", value: "admin" },
  { key: "SEED_USER_NAME", value: "Admin" },
];

const targets = ["production", "development"];

function api(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://api.vercel.com${urlPath}`);
    if (project.orgId.startsWith("team_")) {
      url.searchParams.set("teamId", project.orgId);
    }
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        method,
        host: url.hostname,
        path: url.pathname + url.search,
        rejectUnauthorized: false, // corp TLS proxy
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let buf = "";
        res.on("data", (c) => (buf += c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: buf, headers: res.headers }),
        );
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function deleteIfExists(key, target) {
  const list = await api(
    "GET",
    `/v9/projects/${project.projectId}/env?decrypt=false`,
  );
  if (list.status !== 200) {
    throw new Error(`Failed to list env vars: ${list.status} ${list.body}`);
  }
  const all = JSON.parse(list.body).envs ?? [];
  const matches = all.filter(
    (e) => e.key === key && (e.target ?? []).includes(target),
  );
  for (const m of matches) {
    const del = await api(
      "DELETE",
      `/v9/projects/${project.projectId}/env/${m.id}`,
    );
    if (del.status !== 200 && del.status !== 201) {
      console.warn(`  ! failed to delete ${key} (${m.id}): ${del.status}`);
    }
  }
}

async function upsert(key, value, target) {
  await deleteIfExists(key, target);
  const create = await api("POST", `/v10/projects/${project.projectId}/env`, {
    key,
    value,
    type: "encrypted",
    target: [target],
  });
  if (create.status !== 200 && create.status !== 201) {
    return `FAILED ${create.status} ${create.body.slice(0, 120)}`;
  }
  return "OK";
}

console.log(`Project: ${project.projectName} (${project.projectId})`);
console.log(`Token suffix: ...${token.slice(-6)}`);
console.log(`Session secret: ${sessionSecret.slice(0, 6)}… (${sessionSecret.length} chars)`);

for (const target of targets) {
  console.log(`\n--- ${target} ---`);
  for (const v of vars) {
    const result = await upsert(v.key, v.value, target);
    console.log(`  ${v.key.padEnd(28)} => ${result}`);
  }
}

console.log("\ndone");
