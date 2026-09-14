import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

/**
 * Klien Prisma tunggal — docs/06-DATABASE-SCHEMA.md §6.7.
 *
 * Prisma 7 mewajibkan driver adapter: URL koneksi diberikan di sini, bukan di
 * schema.prisma. Lihat docs/adr/ADR-007-prisma-driver-adapter.md
 *
 * Satu-satunya berkas yang boleh mengimpor client hasil generate.
 * Seluruh kode lain memakai `import { db } from "@/lib/db"`.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL belum diisi. Salin .env.example menjadi .env lalu isi nilainya.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

// Di development, Next.js memuat ulang modul setiap perubahan.
// Tanpa ini, setiap reload membuat koneksi baru sampai database menolak.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
