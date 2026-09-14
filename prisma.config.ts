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
 *
 * Catatan: helper `env()` bawaan Prisma MELEMPAR error bila variabel kosong,
 * sehingga `prisma generate` akan gagal di mesin yang belum punya database.
 * Karena itu kita membaca process.env langsung dan menyertakan `datasource`
 * hanya bila URL-nya ada — generate tetap bisa jalan tanpa database.
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
