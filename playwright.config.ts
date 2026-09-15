import { defineConfig, devices } from "@playwright/test";

/**
 * Uji E2E — docs/13 §13.3: lima alur kritis, dijalankan dengan V0_MOCK=true.
 *
 * Lokal : `pnpm test:e2e` memakai server dev yang sudah berjalan (atau
 *         menjalankannya). Server WAJIB punya env E2E: V0_MOCK=true,
 *         VERCEL_MOCK=true, MAIL_OUTBOX_DIR sama dengan di bawah.
 * CI    : server production (`pnpm start`) disiapkan oleh workflow.
 */

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "e2e",
  // Alur memakai database yang sama dan menunggu pipeline build tiruan;
  // dijalankan berurutan supaya deterministik.
  workers: 1,
  fullyParallel: false,
  timeout: 180_000,
  expect: { timeout: 45_000 },
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL,
    locale: "id-ID",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Lokal memakai Chrome yang terpasang; CI mengunduh Chromium.
        ...(isCI ? {} : { channel: "chrome" }),
      },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: isCI ? "pnpm start" : "pnpm dev",
        url: `${baseURL}/masuk`,
        reuseExistingServer: !isCI,
        timeout: 240_000,
      },
});
