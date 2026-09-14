# ADR-003 — PostgreSQL (Neon) + Prisma ORM

**Status:** Accepted
**Tanggal:** 2026-09-14
**Versi:** `prisma@7.10.0`, `@prisma/client@7.10.0`

## Konteks

Data SaCMS sangat relasional: pengguna memiliki project; project memiliki versi, pesan,
job, dan deployment; job memiliki langkah. Konsistensi penting karena kuota dan kredit
adalah angka yang tidak boleh salah hitung.

## Keputusan

**PostgreSQL 16** di **Neon**, diakses lewat **Prisma 7.10.0**.

> **Catatan versi.** Pada 2026-09-14, tag `latest` Prisma menunjuk ke `8.0.0-rc.14` yang
> masih _release candidate_. Kita mengunci **7.10.0** (tag `prev`, stabil). Naik ke v8
> memerlukan ADR baru.

## Alternatif yang Dipertimbangkan

| Alternatif        | Kelebihan                                     | Kekurangan                                                             | Alasan ditolak                                          |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| Drizzle ORM       | Ringan, SQL-first, cepat di edge              | Skema kurang terbaca sebagai dokumentasi; tooling migrasi lebih mentah | Prisma lebih sesuai untuk tim yang bekerja dari dokumen |
| MongoDB           | Skema fleksibel                               | Transaksi lintas dokumen merepotkan; data kita jelas relasional        | Salah bentuk data                                       |
| PlanetScale MySQL | Skala baik                                    | Tanpa foreign key; kehilangan jaminan integritas                       | Integritas krusial untuk kredit                         |
| Supabase Postgres | Lengkap dengan auth & storage                 | Kita sudah memilih Better Auth; tidak ingin dua platform               | Tumpang tindih                                          |
| **Neon + Prisma** | Branching database, serverless, skema terbaca | Cold start pada tier rendah                                            | **Dipilih**                                             |

## Konsekuensi

**Positif:**

- **Branching Neon** adalah keuntungan operasional nyata: setiap PR mendapat database
  sendiri, dan setiap deploy production didahului snapshot yang menjadi titik pulih
  ([14 §14.5](../14-DEPLOYMENT-GO-LIVE.md)).
- `schema.prisma` berfungsi ganda sebagai dokumentasi yang selalu akurat, karena ia
  adalah sumber skema itu sendiri.
- Transaksi dengan penguncian baris tersedia — dasar mekanisme reservasi kredit di
  [11 §11.4](../11-QUOTA-DAN-BILLING.md).

**Negatif:**

- Prisma 7 mengubah konfigurasi (`prisma.config.ts`, generator `prisma-client` dengan
  `output` wajib). Perlu diverifikasi saat scaffold Fase 0.
- Prisma menambah ukuran bundel di runtime serverless.
- Cold start Neon terasa pada permintaan pertama setelah idle.

## Kapan Ditinjau Ulang

- Prisma 8 stabil dan menawarkan keuntungan yang jelas.
- Kinerja query menjadi hambatan yang **terukur**, bukan dugaan.
