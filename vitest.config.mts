import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Uji unit & integrasi service layer — docs/03 §3.7 (coverage service ≥ 70%).
 *
 * Service diuji terhadap PostgreSQL sungguhan (bukan tiruan Prisma): kuota,
 * penguncian baris, dan refund hanya bermakna bila transaksinya nyata. Vendor
 * (v0, Vercel, email) selalu memakai mesin tiruan — lihat tests/setup.ts.
 */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    // Berkas uji berbagi database & pengaturan sistem (kill switch, aturan AI).
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/services/**/*.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 70, statements: 70 },
    },
  },
});
