# ADR-007 — Driver Adapter Prisma 7 (`@prisma/adapter-pg`)

**Status:** Accepted
**Tanggal:** 2026-09-14
**Terkait:** melengkapi [ADR-003](./ADR-003-postgres-prisma.md) (tidak menggantikannya)

## Konteks

[ADR-003](./ADR-003-postgres-prisma.md) memilih PostgreSQL (Neon) + Prisma 7.10.0, dengan
catatan bahwa konfigurasi Prisma 7 "perlu diverifikasi saat scaffold Fase 0".

Verifikasi itu dilakukan, dan hasilnya lebih besar dari sekadar detail konfigurasi.
Prisma 7 mengubah dua hal yang mengikat arsitektur:

1. **URL koneksi tidak boleh lagi ada di `schema.prisma`.** Properti `url` dan `directUrl`
   pada blok `datasource` ditolak dengan error `P1012`. URL untuk migrate/introspect
   pindah ke `prisma.config.ts`.
2. **`PrismaClient` mewajibkan driver adapter.** Tidak ada lagi koneksi bawaan lewat query
   engine; aplikasi harus menyediakan driver database sendiri.

Keduanya ditemukan saat menjalankan `prisma generate` pertama kali, bukan dari dokumentasi.

## Keputusan

Memakai **`@prisma/adapter-pg@7.10.0`** (di atas `node-postgres`) sebagai driver adapter.

Konsekuensi struktural yang mengikat:

| Berkas                 | Isi                                                                            |
| ---------------------- | ------------------------------------------------------------------------------ |
| `prisma/schema.prisma` | `datasource` hanya berisi `provider`                                           |
| `prisma.config.ts`     | `datasource.url` untuk migrate — memakai `DIRECT_URL`, jatuh ke `DATABASE_URL` |
| `src/lib/db.ts`        | `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`            |

## Alternatif yang Dipertimbangkan

| Alternatif                                          | Kelebihan                                                                                             | Kekurangan                                                   | Alasan                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `@prisma/adapter-neon` + `@neondatabase/serverless` | Dirancang untuk serverless; HTTP/WebSocket, tanpa tekanan pool TCP                                    | Mengunci ke Neon; butuh konfigurasi WebSocket tambahan       | Ditolak untuk sekarang — lihat pemicu peninjauan |
| **`@prisma/adapter-pg`**                            | Portabel: jalan dengan Neon pooler, Postgres lokal, Postgres mana pun. Contoh resmi Prisma memakainya | Koneksi TCP bisa menumpuk di serverless                      | **Dipilih**                                      |
| Turun ke Prisma 6                                   | Tidak perlu adapter                                                                                   | Mundur ke versi lama untuk menghindari pekerjaan satu berkas | Tidak sebanding                                  |

## Konsekuensi

**Positif:**

- Portabilitas: pengembang bisa memakai Postgres lokal (Docker) tanpa akun Neon, dan
  produksi tetap bisa memakai Neon. Ini menurunkan hambatan onboarding.
- URL koneksi tidak lagi tersebar di dua tempat.
- Pilihan driver menjadi eksplisit dan terkurung di satu berkas.

**Negatif:**

- Di serverless, `node-postgres` membuka koneksi TCP per instance. Diredam oleh
  **connection pooler Neon** (endpoint `-pooler`) yang wajib dipakai sebagai
  `DATABASE_URL`. `DIRECT_URL` (tanpa pooler) khusus untuk migrate.
- Satu dependensi tambahan.

**Yang menjadi lebih sulit:** tidak ada. Penggantian adapter menyentuh satu berkas
(`src/lib/db.ts`) karena seluruh aplikasi mengakses database lewat `import { db }`.

## Catatan Operasional

`prisma.config.ts` membaca `process.env` langsung, bukan helper `env()` bawaan Prisma.
Alasannya: `env()` **melempar error** bila variabel tidak ada, sehingga `prisma generate`
gagal di mesin yang belum punya database — termasuk di CI. Blok `datasource` hanya
disertakan bila URL-nya benar-benar ada.

## Kapan Ditinjau Ulang

- Terukur ada tekanan koneksi di production (error "too many connections", latensi cold
  start naik) → pindah ke `@prisma/adapter-neon`.
- Prisma mengubah lagi kontrak adapter di versi berikutnya.
