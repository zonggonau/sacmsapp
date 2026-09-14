import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Konfigurasi Prisma 7.
 *
 * Sejak Prisma 7, URL koneksi TIDAK boleh lagi ditulis di schema.prisma.
 * - Blok `datasource` di bawah dipakai perintah migrate/introspect saja.
 * - Koneksi runtime aplikasi memakai driver adapter di src/lib/db.ts.
 *
 * Lihat docs/adr/ADR-007-prisma-driver-adapter.md
 */

/**
 * Prisma CLI hanya membaca `.env`, sedangkan Next.js memakai `.env.local`.
 * Tanpa ini, `prisma migrate` tidak melihat DATABASE_URL yang sama dengan
 * aplikasi. Kita muat sendiri dengan urutan presedens yang sama seperti
 * Next.js (.env.local menimpa .env), memakai loadEnvFile bawaan Node 24
 * sehingga tidak perlu dependensi dotenv.
 */
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), file));
  } catch {
    // Berkas tidak ada — wajar. Di CI seluruh env datang dari lingkungan.
  }
}

/**
 * Helper `env()` bawaan Prisma MELEMPAR error bila variabel kosong, sehingga
 * `prisma generate` gagal di mesin yang belum punya database. Kita membaca
 * process.env langsung dan menyertakan `datasource` hanya bila URL-nya ada.
 */
const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),

  // Migrate butuh koneksi langsung (bukan lewat pooler).
  ...(migrationUrl ? { datasource: { url: migrationUrl } } : {}),

  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
