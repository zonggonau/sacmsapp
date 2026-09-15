# 14 — Deployment & Go-Live

## 14.1 Lingkungan

| Lingkungan     | URL                | Database              | v0                        | Tujuan                   |
| -------------- | ------------------ | --------------------- | ------------------------- | ------------------------ |
| **Local**      | `localhost:3000`   | Neon branch `dev`     | `V0_MOCK=true`            | Pengembangan sehari-hari |
| **Preview**    | otomatis per PR    | Neon branch per PR    | `V0_MOCK=true`            | Tinjauan kode & UI       |
| **Staging**    | `staging.sacms.id` | Neon branch `staging` | v0 nyata (kunci terpisah) | Uji akhir sebelum rilis  |
| **Production** | `sacms.id`         | Neon `main`           | v0 nyata                  | Pengguna sungguhan       |

Aturan:

- Preview memakai mock agar PR tidak membakar kredit dan tidak bergantung jaringan.
- Staging memakai v0 **nyata** dengan kunci berbeda dan batas anggaran sendiri. Kalau
  staging memakai mock, integrasi nyata baru diuji pertama kali di production — dan itu
  selalu berakhir buruk.
- Production **tidak pernah** menerima deploy langsung dari mesin siapa pun. Hanya dari CI.

## 14.2 Cabang & Rilis

```
main      -> production   (dilindungi; hanya lewat PR dari develop; wajib review)
develop   -> staging      (integrasi)
feat/*    -> preview      (satu fitur, umur pendek)
fix/*     -> preview
```

Aturan:

- `main` dilindungi: butuh PR, CI hijau, dan satu persetujuan.
- Commit memakai Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).
- Rilis diberi tag `v1.0.0`, dengan catatan rilis berbahasa Indonesia.
- Squash merge, supaya riwayat `main` terbaca sebagai daftar fitur.

## 14.3 Variabel Lingkungan

```bash
# --- Inti ---
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://sacms.id

# --- Database ---
DATABASE_URL=postgresql://...        # Neon, pooled
DIRECT_URL=postgresql://...          # Neon, direct (untuk migrasi)

# --- Auth ---
BETTER_AUTH_SECRET=                  # openssl rand -base64 32
BETTER_AUTH_URL=https://sacms.id
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# --- AI ---
V0_API_KEY=
V0_DEFAULT_MODEL=v0-mini
V0_MOCK=false

# --- Deployment ---
VERCEL_TOKEN=                        # akun yang SAMA dengan V0_API_KEY (ADR-008)
VERCEL_TEAM_ID=
VERCEL_WEBHOOK_SECRET=               # kosong = semua webhook ditolak
VERCEL_MOCK=false                    # otomatis tiruan bila V0_MOCK=true

# --- Infrastruktur ---
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
BLOB_READ_WRITE_TOKEN=
RESEND_API_KEY=
EMAIL_FROM="SaCMS <noreply@sacms.id>"

# --- Operasional ---
CRON_SECRET=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# --- Seed (hanya saat inisialisasi awal) ---
SEED_SUPERADMIN_EMAIL=
SEED_SUPERADMIN_PASSWORD=            # minimal 16 karakter; hapus setelah dipakai
```

`.env.example` di repositori memuat **semua nama di atas tanpa nilai**. Dengan begitu
pengembang baru langsung tahu apa yang perlu diisi, dan `lib/env.ts` akan menolak start
bila ada yang terlewat.

### Memasang env ke Vercel secara otomatis — `pnpm env:vercel`

Tidak perlu mengetik satu per satu di dashboard:

1. Salin `.env.example` menjadi **`.env.production.local`** (ter-`.gitignore`) dan isi nilai
   **production** — bukan salinan `.env.local`.
2. Tambahkan di berkas yang sama (tidak ikut dipasang):
   `VERCEL_DEPLOY_TOKEN` (token akun/tim **pemilik project aplikasi SaCMS**),
   `VERCEL_DEPLOY_PROJECT` (nama project), dan `VERCEL_DEPLOY_TEAM` bila milik tim.
3. `pnpm env:vercel` — pratinjau: memvalidasi dan mencetak **nama** variabel saja.
4. `pnpm env:vercel --terapkan` — upsert ke target production (`--preview` untuk preview juga).
5. Redeploy di Vercel; env baru hanya berlaku di deployment berikutnya.

Skrip menolak memasang bila: `DATABASE_URL` menunjuk localhost, `BETTER_AUTH_URL` /
`NEXT_PUBLIC_APP_URL` bukan https publik, secret < 32 karakter, Upstash kosong, atau ada
`SKIP_ENV_VALIDATION` / `SEED_SUPERADMIN_PASSWORD`. `NEXT_PUBLIC_*` dipasang `plain`, sisanya
`encrypted`. Nilai tidak pernah dicetak.

> **`VERCEL_TOKEN` untuk aplikasi ≠ token untuk skrip ini.** `VERCEL_TOKEN` dipakai SaCMS
> mengelola website **pengguna** (akun yang sama dengan `V0_API_KEY`, ADR-008). Bila aplikasi
> SaCMS sendiri di-hosting di akun Vercel lain, `VERCEL_DEPLOY_TOKEN` harus token akun itu.

## 14.4 Pipeline CI

```yaml
# .github/workflows/ci.yml (ringkasan)
on: [pull_request, push]

jobs:
  quality: # lint, format, typecheck, prisma validate, build (env pengganti, tanpa koneksi)
    steps:
      - pnpm install --frozen-lockfile
      - pnpm lint && pnpm format:check && pnpm typecheck
      - pnpm build

  unit: # Postgres sekali pakai, vendor tiruan
    steps:
      - pnpm db:deploy && pnpm db:seed
      - pnpm test:coverage # vitest, gagal bila coverage service < 70%

  e2e: # Postgres + emulator Upstash (SRH), next start, V0_MOCK & VERCEL_MOCK
    steps:
      - pnpm db:deploy && pnpm db:seed
      - pnpm build
      - pnpm test:e2e # 5 alur kritis + pemeriksaan pelanggaran CSP

  security:
    steps:
      - gitleaks
      - pnpm audit --audit-level=high
```

Catatan penting:

- `pnpm/action-setup` **tanpa** `version:` — versi diambil dari `packageManager` di
  `package.json`. Menulis keduanya membuat seluruh job gagal sebelum langkah pertama.
- `next build` memuat modul rute API saat mengumpulkan data halaman; `lib/db` dan
  `lib/ratelimit` menolak dimuat tanpa `DATABASE_URL`/Upstash. Job `quality` karena itu
  memberi nilai pengganti (tidak ada koneksi yang dibuka saat build).

Merge ke `main` diblokir bila salah satu job merah. Tidak ada pengecualian, termasuk
"cuma perbaikan kecil".

## 14.5 Urutan Deploy

Urutan ini penting. Migrasi berjalan **sebelum** kode baru aktif, dan migrasi wajib
kompatibel mundur ([06 §6.6](./06-DATABASE-SCHEMA.md)) — selama beberapa detik, kode lama
dan skema baru berjalan bersamaan.

```
1. PR develop -> main disetujui
2. CI hijau
3. Ambil branch Neon dari main sebagai titik pulih
4. prisma migrate deploy            <- migrasi dulu
5. Vercel build & deploy
6. Uji smoke otomatis pada production (§14.6)
7. Pantau Sentry & log 15 menit
8. Bila bermasalah -> rollback (§14.7)
```

## 14.6 Uji Smoke Production (otomatis setelah deploy)

- [ ] `GET /` mengembalikan 200
- [ ] `GET /masuk` mengembalikan 200
- [ ] `GET /api/auth/session` merespons
- [ ] Koneksi database sehat (endpoint `/api/health`)
- [ ] Redis merespons
- [ ] `/admin` tanpa sesi → redirect, bukan 500
- [ ] Sentry menerima event uji

Gagal salah satu → rollback otomatis.

## 14.7 Rollback

| Masalah                           | Tindakan                                           | Waktu      |
| --------------------------------- | -------------------------------------------------- | ---------- |
| Bug di kode                       | Vercel → Instant Rollback ke deployment sebelumnya | < 1 menit  |
| Migrasi merusak data              | Pulihkan branch Neon dari titik pulih langkah 3    | < 10 menit |
| Integrasi pihak ketiga bermasalah | Nyalakan kill switch / maintenance dari `/admin`   | detik      |
| Lonjakan biaya                    | Kill switch + tangguhkan akun pelaku               | detik      |

Karena migrasi selalu kompatibel mundur, rollback kode **tidak** memerlukan rollback
skema. Ini alasan sesungguhnya aturan tiga langkah di [06 §6.6](./06-DATABASE-SCHEMA.md) ada.

## 14.8 Cron

| Jadwal         | Endpoint                     | Tugas                                                                                                           |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `*/5 * * * *`  | `/api/cron/sweep-stuck-jobs` | Job `RUNNING` melewati `timeoutAt` **dan** job `QUEUED` yang tak pernah dimulai (>15 menit) → `FAILED` + refund |
| `* * * * *`    | `/api/cron/run-queued`       | Menjalankan job `QUEUED`: antrean ulang karena rate limit, atau yang `after()`-nya tidak berjalan               |
| `*/10 * * * *` | `/api/cron/verify-domains`   | Periksa domain `PENDING_DNS` / `VERIFYING` yang ditambahkan dalam 24 jam terakhir                               |
| `*/5 * * * *`  | `/api/cron/sync-deployments` | Mulai deployment `QUEUED` yang tertinggal; samakan `BUILDING` dengan Vercel (timeout 20 menit)                  |
| `0 * * * *`    | `/api/cron/refund-stale`     | Refund `UsageEvent` `RESERVED` > 30 menit                                                                       |
| `0 2 * * *`    | `/api/cron/reconcile-costs`  | Isi `vendorCostIdr` dari laporan v0                                                                             |
| `0 3 * * *`    | `/api/cron/reset-periods`    | Reset kuota pengguna yang periodenya habis                                                                      |
| `0 4 * * *`    | `/api/cron/cleanup`          | Hapus sesi kedaluwarsa, log lama                                                                                |

Webhook Vercel didaftarkan di dashboard tim Vercel: URL `/api/webhooks/vercel`, event
`deployment.*`, secret yang sama dengan `VERCEL_WEBHOOK_SECRET`. Webhook mempercepat
pembaruan status; tanpa webhook, cron `sync-deployments` tetap menyelesaikannya.

Setiap endpoint cron **wajib**:

```ts
const auth = req.headers.get("authorization");
if (auth !== `Bearer ${env.CRON_SECRET}`) {
  return new Response("Unauthorized", { status: 401 });
}
```

Tanpa ini, siapa pun dapat memicu reset kuota seluruh pengguna.

**Status implementasi (Fase 6):** `refund-stale`, `reset-periods`, dan `reconcile-costs` kini
ada, bersama `sweep-stuck-jobs`, `run-queued`, `verify-domains`, `sync-deployments`.
`cleanup` belum dibuat (Fase 7).

**Penjadwalan belum dipasang (`vercel.json` sengaja tidak ada).** Paket Vercel Hobby hanya
mengizinkan cron **sekali sehari**; mendaftarkan jadwal per menit/5 menit di atas membuat
deploy **ditolak**. Keputusan penjadwal (Vercel Pro, atau penjadwal eksternal yang memanggil
endpoint dengan `Authorization: Bearer $CRON_SECRET`) diambil di Fase 7. Sampai itu:
polling UI + `after()` tetap menjalankan build dan deploy; yang tertunda hanya jaring
pengaman latar (penyapu, reset periode, rekonsiliasi biaya).

## 14.9 Checklist Go-Live

### Teknis

- [ ] Seluruh checklist [12 §12.8](./12-KEAMANAN.md) lulus
- [ ] Semua variabel lingkungan production terisi dan tervalidasi
- [ ] Domain `sacms.id` aktif dengan HTTPS; `www` diarahkan ke apex
- [ ] Neon PITR aktif; **pemulihan sudah diuji nyata sekali**
- [ ] Semua cron terdaftar dan pernah berhasil dijalankan
- [ ] Sentry, log drain, dan uptime monitor aktif
- [ ] Rate limit aktif di production (bukan hanya di lokal)
- [ ] Anggaran & ambang biaya v0 dipasang; kill switch otomatis diuji
- [ ] `robots.txt` memblokir `/admin` dan `/projects`
- [ ] `sitemap.xml` hanya memuat halaman publik

### Produk

- [ ] Alur penuh berhasil di production dengan akun nyata
- [ ] Semua pesan error berbahasa Indonesia dan dapat ditindaklanjuti
- [ ] Empty state, loading, dan error ada di setiap halaman
- [ ] Responsif diverifikasi pada ponsel nyata (360px)
- [ ] Dark & light keduanya rapi di setiap halaman
- [ ] Halaman harga sesuai dengan tabel `Plan` di database

### Legal & Operasional

- [ ] Syarat Layanan & Kebijakan Privasi terbit (menyebut pemakaian AI pihak ketiga)
- [ ] Kanal dukungan aktif (email/WhatsApp) dan tercantum
- [ ] Akun Super Admin dibuat; `SEED_SUPERADMIN_PASSWORD` dihapus dari env
- [ ] Runbook insiden ([12 §12.7](./12-KEAMANAN.md)) tersedia dan dapat dijalankan dari `/admin`
- [ ] Rencana biaya bulanan dihitung (§14.10)

## 14.10 Perkiraan Biaya Operasional

| Komponen      | Biaya bulanan (perkiraan)                            |
| ------------- | ---------------------------------------------------- |
| Vercel Pro    | ~$20                                                 |
| Neon (Launch) | ~$19                                                 |
| Upstash Redis | ~$0–10 (pay as you go)                               |
| Resend        | $0 (3.000 email/bln) → $20                           |
| Sentry        | $0 (developer) → $26                                 |
| Domain        | ~$15/tahun                                           |
| **v0 API**    | **variabel — komponen terbesar dan paling berisiko** |

Biaya v0 adalah alasan seluruh mekanisme kuota, reservasi kredit, ambang biaya, dan kill
switch otomatis ada di dokumen ini. Sebelum go-live, jalankan 20 generate nyata di
staging, catat biayanya, dan hitung biaya rata-rata per website. Angka itu menentukan
apakah harga Rp 149.000 menghasilkan margin atau kerugian.

## 14.11 Tujuh Hari Pertama Setelah Go-Live

| Hari | Fokus                                                                    |
| ---- | ------------------------------------------------------------------------ |
| 1    | Pantau Sentry tiap jam; pantau `/admin` untuk build gagal                |
| 2–3  | Tinjau setiap build gagal satu per satu; perbaiki penyebab paling sering |
| 4    | Tinjau biaya nyata vs perkiraan; setel ulang kuota bila perlu            |
| 5    | Kumpulkan umpan balik pengguna pertama                                   |
| 6    | Perbaiki tiga hambatan terbesar yang ditemukan                           |
| 7    | Retrospeksi; putuskan prioritas v1.1 berdasarkan data, bukan dugaan      |
