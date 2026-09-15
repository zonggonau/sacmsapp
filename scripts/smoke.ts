/**
 * Uji smoke production — docs/14 §14.6.
 *
 *   pnpm smoke https://sacms.id
 *
 * Keluar dengan kode 1 bila ada pemeriksaan gagal. Dipanggil otomatis oleh
 * .github/workflows/smoke.yml setelah Vercel melaporkan deployment production.
 */
export {};

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("Pakai: pnpm smoke <URL production>, mis. pnpm smoke https://sacms.id");
  process.exit(2);
}

type Check = { name: string; run: () => Promise<string | null> };

const get = (path: string, init?: RequestInit) =>
  fetch(`${base}${path}`, { redirect: "manual", ...init });

const checks: Check[] = [
  {
    name: "GET / → 200",
    run: async () => {
      const r = await get("/");
      return r.status === 200 ? null : `status ${r.status}`;
    },
  },
  {
    name: "GET /masuk → 200",
    run: async () => {
      const r = await get("/masuk");
      return r.status === 200 ? null : `status ${r.status}`;
    },
  },
  {
    name: "GET /api/auth/get-session merespons",
    run: async () => {
      const r = await get("/api/auth/get-session");
      return r.status < 500 ? null : `status ${r.status}`;
    },
  },
  {
    name: "GET /api/health → database & Redis sehat",
    run: async () => {
      const r = await get("/api/health");
      const body = (await r.json().catch(() => null)) as {
        status?: string;
        checks?: unknown;
      } | null;
      return r.status === 200 && body?.status === "ok"
        ? null
        : `status ${r.status} ${JSON.stringify(body?.checks ?? null)}`;
    },
  },
  {
    name: "GET /admin tanpa sesi → redirect, bukan 500",
    run: async () => {
      const r = await get("/admin");
      const location = r.headers.get("location") ?? "";
      return r.status >= 300 && r.status < 400 && location.includes("/masuk")
        ? null
        : `status ${r.status} location ${location || "-"}`;
    },
  },
];

async function main() {
  let failed = 0;
  for (const check of checks) {
    try {
      const problem = await check.run();
      console.log(
        `${problem ? "GAGAL" : "OK   "}  ${check.name}${problem ? ` — ${problem}` : ""}`,
      );
      if (problem) failed += 1;
    } catch (error) {
      failed += 1;
      console.log(
        `GAGAL  ${check.name} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(
    failed === 0
      ? `\nSemua pemeriksaan lulus (${base}).`
      : `\n${failed} pemeriksaan gagal (${base}).`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
