import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { test as base, expect, type Page } from "@playwright/test";

/**
 * Perlengkapan uji E2E — database langsung untuk MENYIAPKAN keadaan dan
 * MEMERIKSA hasil; interaksi pengguna tetap lewat peramban.
 */

export const OUTBOX_DIR = resolve(process.env.MAIL_OUTBOX_DIR ?? "e2e/.outbox");
export const PASSWORD = "Rahasia-E2E-12345";

const run = promisify(execFile);
const DB_TASK = resolve("e2e/support/db-task.ts");

/** Menjalankan tugas di `db-task.ts` (proses tsx terpisah, lihat alasannya di sana). */
export async function dbTask<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { stdout } = await run(
    process.execPath,
    ["--import", "tsx", DB_TASK, name, JSON.stringify(args)],
    {
      env: process.env,
    },
  );
  const lastLine = stdout.trim().split("\n").at(-1) ?? "null";
  return JSON.parse(lastLine) as T;
}

export function uniqueEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@contoh.test`;
}

export type E2eUser = { id: string; email: string; name: string };

/** Pengguna terverifikasi dengan kata sandi PASSWORD. */
export function createUser(input: {
  label: string;
  role?: "USER" | "SUPER_ADMIN";
  planSlug?: string;
  creditsUsed?: number;
}) {
  return dbTask<E2eUser>("createUser", {
    ...input,
    email: uniqueEmail(input.label),
    password: PASSWORD,
  });
}

/** Tautan terakhir di kotak keluar untuk alamat & subjek tertentu. */
export async function waitForMailLink(
  to: string,
  subjectIncludes: string,
  timeoutMs = 30_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(OUTBOX_DIR)) {
      const files = (await readdir(OUTBOX_DIR)).sort().reverse();
      for (const file of files) {
        const entry = JSON.parse(await readFile(join(OUTBOX_DIR, file), "utf8")) as {
          to: string;
          subject: string;
          devHint?: string;
        };
        if (
          entry.to === to &&
          entry.subject.includes(subjectIncludes) &&
          entry.devHint
        ) {
          return entry.devHint;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Email "${subjectIncludes}" untuk ${to} tidak muncul di ${OUTBOX_DIR}`,
  );
}

export async function signInViaForm(page: Page, email: string, password = PASSWORD) {
  await page.goto("/masuk");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

export const randomIp = () =>
  `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250) + 1}`;

/**
 * Setiap uji tampil sebagai alamat IP berbeda, supaya rate limit masuk/daftar
 * (per IP) tidak terpicu oleh uji yang berulang — tanpa melonggarkan kode
 * production. Di Vercel, header ini ditimpa edge dan tidak bisa dipalsukan.
 */
export const test = base.extend({
  // Parameter kedua sengaja tidak dinamai `use` agar tidak dikira hook React.
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
    await provide(context);
  },

  // Setiap uji sekaligus memeriksa CSP (docs/12 §12.3): pelanggaran apa pun
  // di konsol peramban menggagalkan uji, supaya kebijakan yang terlalu ketat
  // (fitur rusak) maupun sumber baru yang belum didaftarkan langsung ketahuan.
  page: async ({ page }, provide) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content Security Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await provide(page);
    expect(violations, "Pelanggaran CSP di konsol peramban").toEqual([]);
  },
});

export { expect };
