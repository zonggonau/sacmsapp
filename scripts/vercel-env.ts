/**
 * Memasang environment variable production ke project Vercel — docs/14 §14.3.
 *
 *   pnpm env:vercel                 pratinjau: validasi + daftar NAMA yang akan dipasang
 *   pnpm env:vercel --terapkan      pasang (upsert) ke target production
 *   pnpm env:vercel --terapkan --preview   juga ke target preview
 *   pnpm env:vercel --file .env.staging.local
 *
 * Sumber nilai: `.env.production.local` (ter-.gitignore). JANGAN memakai
 * `.env.local`: isinya untuk development (database localhost, mode tiruan) dan
 * akan membuat production rusak.
 *
 * Kredensial skrip (bukan ikut dipasang):
 *   VERCEL_DEPLOY_TOKEN    token akun/tim Vercel PEMILIK project aplikasi SaCMS
 *   VERCEL_DEPLOY_PROJECT  nama atau id project Vercel aplikasi SaCMS
 *   VERCEL_DEPLOY_TEAM     (opsional) id tim bila project milik tim
 * Boleh ditaruh di environment shell atau di berkas yang sama.
 *
 * Nilai rahasia TIDAK PERNAH dicetak.
 */
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const args = process.argv.slice(2);
const apply = args.includes("--terapkan");
const withPreview = args.includes("--preview");
const fileIndex = args.indexOf("--file");
const file = fileIndex >= 0 ? args[fileIndex + 1]! : ".env.production.local";

const SCRIPT_KEYS = [
  "VERCEL_DEPLOY_TOKEN",
  "VERCEL_DEPLOY_PROJECT",
  "VERCEL_DEPLOY_TEAM",
];

/** Wajib ada — lib/env.ts dan lib/ratelimit.ts menolak start tanpanya di production. */
const REQUIRED = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "CRON_SECRET",
];

/** Tidak pernah dipasang ke production. */
const FORBIDDEN = ["SKIP_ENV_VALIDATION", "SEED_SUPERADMIN_PASSWORD", "NODE_ENV"];

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

let values: Record<string, string>;
try {
  values = parseEnv(readFileSync(file, "utf8")) as Record<string, string>;
} catch {
  fail(
    `Berkas ${file} tidak bisa dibaca. Salin .env.example menjadi ${file}, lalu isi nilai PRODUCTION.`,
  );
}

const token = process.env.VERCEL_DEPLOY_TOKEN ?? values.VERCEL_DEPLOY_TOKEN;
const project = process.env.VERCEL_DEPLOY_PROJECT ?? values.VERCEL_DEPLOY_PROJECT;
const team = process.env.VERCEL_DEPLOY_TEAM ?? values.VERCEL_DEPLOY_TEAM;

const entries = Object.entries(values).filter(
  ([key, value]) => !SCRIPT_KEYS.includes(key) && value.trim() !== "",
);
const env = Object.fromEntries(entries);

/* ---------- validasi ---------- */

const problems: string[] = [];
const warnings: string[] = [];

for (const key of REQUIRED) {
  if (!env[key]) problems.push(`${key} wajib diisi`);
}
for (const key of FORBIDDEN) {
  if (key in env)
    problems.push(`${key} tidak boleh dipasang ke production — hapus dari ${file}`);
}

const isLocal = (url: string) => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(url);

if (env.DATABASE_URL && isLocal(env.DATABASE_URL)) {
  problems.push(
    "DATABASE_URL menunjuk ke komputer lokal — Vercel tidak bisa menjangkaunya (pakai Neon)",
  );
}
for (const key of ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"]) {
  const v = env[key];
  if (v && (!v.startsWith("https://") || isLocal(v))) {
    problems.push(`${key} harus alamat https publik website SaCMS, bukan localhost`);
  }
}
if (
  env.BETTER_AUTH_URL &&
  env.NEXT_PUBLIC_APP_URL &&
  env.BETTER_AUTH_URL !== env.NEXT_PUBLIC_APP_URL
) {
  warnings.push(
    "BETTER_AUTH_URL berbeda dari NEXT_PUBLIC_APP_URL — login bisa gagal karena origin",
  );
}
for (const key of ["BETTER_AUTH_SECRET", "CRON_SECRET"]) {
  if (env[key] && env[key].length < 32) problems.push(`${key} minimal 32 karakter`);
}
if (env.V0_MOCK !== "false")
  warnings.push('V0_MOCK bukan "false" — production akan memakai mesin AI tiruan');
if (env.V0_MOCK === "false" && !env.V0_API_KEY)
  problems.push("V0_API_KEY wajib bila V0_MOCK=false");
if (env.VERCEL_MOCK !== "false")
  warnings.push('VERCEL_MOCK bukan "false" — penerbitan website pengguna akan tiruan');
if (!env.RESEND_API_KEY)
  warnings.push(
    "RESEND_API_KEY kosong — email verifikasi tidak terkirim, pengguna tidak bisa masuk",
  );
if (!env.VERCEL_WEBHOOK_SECRET)
  warnings.push("VERCEL_WEBHOOK_SECRET kosong — semua webhook Vercel ditolak");

/* ---------- ringkasan (nama saja) ---------- */

const targets = withPreview ? ["production", "preview"] : ["production"];

console.log(`Sumber      : ${file}`);
console.log(
  `Project     : ${project ?? "(VERCEL_DEPLOY_PROJECT belum diisi)"}${team ? ` (tim ${team})` : ""}`,
);
console.log(`Target      : ${targets.join(", ")}`);
console.log(`Variabel (${entries.length}):`);
for (const [key] of entries) {
  const kind = key.startsWith("NEXT_PUBLIC_") ? "plain    " : "encrypted";
  console.log(`  ${kind}  ${key}`);
}
for (const w of warnings) console.log(`\n! ${w}`);
if (problems.length > 0) {
  console.error("\nTidak bisa dipasang:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

if (!apply) {
  console.log(
    "\nPratinjau selesai. Jalankan dengan --terapkan untuk memasang ke Vercel.",
  );
  process.exit(0);
}

if (!token || !project)
  fail("VERCEL_DEPLOY_TOKEN dan VERCEL_DEPLOY_PROJECT wajib untuk --terapkan.");

/* ---------- pasang ---------- */

void install(token, project);

async function install(token: string, project: string) {
  const url = new URL(
    `https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/env`,
  );
  url.searchParams.set("upsert", "true");
  if (team) url.searchParams.set("teamId", team);

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      entries.map(([key, value]) => ({
        key,
        value,
        // NEXT_PUBLIC_* dibaca saat build dan terlihat di peramban — bukan rahasia.
        type: key.startsWith("NEXT_PUBLIC_") ? "plain" : "encrypted",
        target: targets,
      })),
    ),
  });

  const body = (await res.json().catch(() => null)) as {
    created?: unknown[];
    failed?: Array<{ error?: { key?: string; message?: string } }>;
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    fail(
      `Vercel menolak (${res.status}): ${body?.error?.message ?? "tanpa pesan"}. Periksa token, nama project, dan tim.`,
    );
  }

  const failed = body?.failed ?? [];
  console.log(
    `\n✓ ${entries.length - failed.length} variabel terpasang ke ${targets.join(" & ")}.`,
  );
  for (const f of failed)
    console.error(`  ✗ ${f.error?.key ?? "?"}: ${f.error?.message ?? "gagal"}`);
  console.log(
    "Env baru berlaku pada deployment BERIKUTNYA — lakukan Redeploy di Vercel atau push commit baru.",
  );
  process.exit(failed.length > 0 ? 1 : 0);
}
