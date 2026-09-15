import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Dijalankan sebelum setiap berkas uji, SEBELUM modul aplikasi dimuat.
 *
 * Mesin tiruan dipaksa di sini dan diperiksa ulang: uji yang tanpa sengaja
 * memanggil v0 atau Vercel sungguhan akan membakar kredit dan menerbitkan situs.
 */
process.env.V0_MOCK = "true";
process.env.VERCEL_MOCK = "true";
process.env.V0_MOCK_DELAY_MS = "5";
process.env.RESEND_API_KEY = "";
process.env.MAIL_OUTBOX_DIR = mkdtempSync(join(tmpdir(), "sacms-uji-mail-"));

// loadEnvFile tidak menimpa variabel yang sudah diisi di atas maupun di CI.
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

if (process.env.V0_MOCK !== "true" || process.env.VERCEL_MOCK !== "true") {
  throw new Error(
    "Mesin tiruan tertimpa — uji dibatalkan agar tidak memakai vendor sungguhan.",
  );
}
