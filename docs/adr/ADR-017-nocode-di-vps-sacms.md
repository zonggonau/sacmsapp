# ADR-017 — SaCMS nocode di VPS SaCMS; Vercel Hanya untuk Website Hasil Generate

**Status:** Accepted — diputuskan pemilik sistem, 2026-09-17
**Tanggal:** 2026-09-17
**Menggantikan:** [ADR-015](./ADR-015-backend-data-dari-sacms-developer.md) keputusan 1
("aplikasi nocode tetap di Vercel") beserta semua turunannya: PgBouncer dan TLS database lewat
internet, cron di `vercel.json`, dan rate limit wajib Upstash.
**Menghidupkan kembali:** [ADR-014](./ADR-014-sacms-di-vps-sendiri-dan-paket-enterprise.md) tahap 1
dan 4 (standalone, Docker, penjadwal cron di VPS) — tahap 5–6 tetap batal.
**Tidak mengubah:** ADR-015 keputusan 2–7 (DB & storage dari SaCMS, MCP, satu project = satu
tenant, paket), [ADR-008](./ADR-008-terbit-lewat-v0-deployments.md), [ADR-016](./ADR-016-satu-pintu-admin-di-sacms.md)
**Diubah oleh:** [ADR-018](./ADR-018-enterprise-di-infrastruktur-bersama.md) — baris storage dan Enterprise
di tabel keputusan

## Keputusan

| Komponen                                          | Tempat                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Aplikasi SaCMS Developer**                      | VPS SaCMS kita sendiri (`164.68.116.79`)                                                |
| **Aplikasi SaCMS nocode (aplikasi ini)**          | **VPS yang sama** — bukan Vercel                                                        |
| PostgreSQL, Redis                                 | VPS yang sama, dipakai bersama                                                          |
| Media seluruh pelanggan                           | Object storage bersama, pemakaian dihitung per pelanggan (ADR-018)                      |
| **Website hasil generate** (Standar/Pro/Business) | **Vercel** lewat `v0.deployments.create`; konten & media dari SaCMS                     |
| **Workspace Enterprise** (di SaCMS)               | Database dan storage bersama; website di **Vercel** — tanpa VPS per workspace (ADR-018) |

**Vercel hanya dipakai untuk satu hal: menghosting website yang dihasilkan pengguna.**
`VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_WEBHOOK_SECRET`, `lib/vercel`, dan `lib/v0` tetap ada
untuk itu.

## Yang Menjadi Lebih Sederhana

Beberapa masalah terberat di ADR-015 hilang, bukan hanya berpindah:

- **Tidak ada koneksi database lewat internet publik.** PgBouncer, `sslmode=verify-full`, dan
  masalah "fungsi Vercel tidak punya IP tetap" tidak lagi relevan. Aplikasi terhubung ke
  PostgreSQL lewat jaringan Docker. Proses Node yang berjalan terus menyimpan pool koneksi
  sendiri.
- **Panggilan ke SaCMS lewat jaringan internal.** MCP, provisioning tenant, dan ringkasan admin
  (ADR-016) berjalan di jaringan Docker. `SACMS_PROVISION_KEY` tidak pernah melintasi internet.
- **Pemindahan domain lebih mudah.** DNS apex `sacms.cloud` **sudah** mengarah ke VPS ini, jadi
  tidak ada perubahan DNS apex. Yang berubah hanya satu blok rute di Caddy.
- **`after()` berjalan tanpa batas durasi serverless.**

## Desain Deployment

### Tata letak di VPS

```
VPS 164.68.116.79
├── Caddy (systemd di host; Caddyfile disinkronkan CI SaCMS)
│     sacms.cloud, www.sacms.cloud          → 127.0.0.1:3001   (nocode)
│     developer., cms., admin., api., *.sacms.cloud, custom domain → 127.0.0.1:3000   (SaCMS)
│
├── /opt/sacms          (compose milik repo SaCMS — pemilik jaringan `sacms_default`)
│     app        127.0.0.1:3000
│     postgres   127.0.0.1:5432   database: sacms, sacms_nocode
│     redis      127.0.0.1:6379
│     db-backup
│
└── /opt/sacms-nocode   (compose milik repo ini — bergabung ke `sacms_default`)
      nocode     127.0.0.1:3001
      cron       penjadwal 9 cron (lihat di bawah)
```

**Dua proyek compose, satu jaringan.** Tiap repo men-deploy sendiri: deploy nocode tidak pernah
me-restart SaCMS atau database, dan sebaliknya.

### ⚠️ Tiga hal di `docker-compose.yml` yang belum di-commit harus diubah

| Hari ini                     | Harus                   | Alasan                                                                                                                                                                                    |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| service bernama `app`        | **`nocode`**            | Di jaringan `sacms_default`, alias `app` sudah dipakai SaCMS. Dua container dengan alias yang sama membuat panggilan internal `http://app:3000` **bergantian** mengenai SaCMS dan nocode. |
| `ports: "0.0.0.0:3005:3000"` | `"127.0.0.1:3001:3000"` | `0.0.0.0` membuka aplikasi lewat HTTP biasa ke internet, **melewati Caddy** (tanpa TLS dan header keamanan). Port yang dipublikasikan Docker juga melewati aturan UFW di Ubuntu.          |
| `volumes: ./src:/app/src:ro` | dihapus                 | Build standalone tidak membaca `src`; mount ini tidak berguna.                                                                                                                            |

Tambahkan `mem_limit` pada kedua aplikasi, supaya lonjakan di satu aplikasi tidak menghabiskan
memori aplikasi lain dan PostgreSQL.

### ⚠️ `NEXT_PUBLIC_*` harus menjadi build-arg

`Dockerfile` hari ini membangun dengan `SKIP_ENV_VALIDATION=true` **tanpa** variabel publik.
Next.js menanam `process.env.NEXT_PUBLIC_*` ke bundel **saat build**, jadi nilai yang diisi di
`.env` server saat runtime tidak dipakai. Tanpa build-arg, image production akan memakai
`http://localhost:3000` untuk:

- `metadataBase` dan Open Graph di layout marketing;
- `sitemap.ts`;
- pemeriksaan `isHttps` di CSP `proxy.ts` (`upgrade-insecure-requests` hilang);
- tautan SaCMS Developer di halaman Enterprise.

CI harus meneruskan `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SACMS_DEVELOPER_URL`,
`NEXT_PUBLIC_SENTRY_DSN`, dan `NEXT_PUBLIC_SUPPORT_*` sebagai `--build-arg`.

### Variabel lingkungan

| Variabel                                 | Nilai di VPS                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`, `DIRECT_URL`             | `postgresql://nocode_app:…@postgres:5432/sacms_nocode` — tanpa PgBouncer |
| `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_URL` | `https://sacms.cloud` (yang pertama sebagai build-arg)                   |
| `SACMS_BASE_URL`                         | `http://app:3000` — jaringan internal                                    |
| `UPSTASH_REDIS_REST_URL/TOKEN`           | Shim REST ke Redis bersama (lihat di bawah)                              |
| `CRON_SECRET`                            | Tetap wajib; dipakai penjadwal                                           |
| `VERCEL_*`, `V0_*`                       | Tetap — untuk website hasil generate                                     |

Sisi SaCMS: `NOCODE_BASE_URL=http://nocode:3000` (ADR-016).

### Database

- Buat database `sacms_nocode` dan peran `nocode_app` yang **hanya** berhak atas database itu.
- CI menjalankan `prisma migrate deploy` di container sekali-jalan **sebelum** `up -d nocode`.
- `max_connections` PostgreSQL (bawaan 100) dibagi dua aplikasi. Atur ukuran pool keduanya
  agar jumlahnya di bawah batas itu.

**⚠️ Backup belum mencakup database kita.** Layanan `db-backup` di compose SaCMS menjalankan
`pg_dump` dengan `PGDATABASE: sacms`, jadi **hanya** database SaCMS yang dicadangkan, dan
hasilnya disimpan di disk VPS yang sama. Sebelum data dipindah dari Neon:

1. Backup harus mencakup `sacms_nocode`.
2. Salinannya harus dikirim ke luar VPS.
3. Pemulihan harus diuji sungguhan satu kali.

### Rate limit

`lib/ratelimit` memakai klien Upstash REST. Kode yang belum di-commit mengganti galat production
menjadi penghitung dalam memori. Penghitung itu bekerja untuk satu instance, tetapi hilang setiap
kali deploy. Rekomendasi: container kecil **`hiett/serverless-redis-http`** yang mengarah ke Redis
bersama (indeks database terpisah dari SaCMS). Dengan begitu `lib/ratelimit` tidak berubah dan
hitungan bertahan melewati deploy.

### Cron

Sembilan cron di `vercel.json` **tidak berjalan di VPS**. Jadwalkan ulang lewat container
penjadwal (mis. `supercronic`) di compose ini, yang memanggil
`http://nocode:3000/api/cron/*` dengan `Authorization: Bearer $CRON_SECRET`, dengan jadwal yang
sama persis:

| Endpoint                               | Jadwal         |
| -------------------------------------- | -------------- |
| `run-queued`                           | `* * * * *`    |
| `sweep-stuck-jobs`, `sync-deployments` | `*/5 * * * *`  |
| `verify-domains`                       | `*/10 * * * *` |
| `refund-stale`                         | `0 * * * *`    |
| `cleanup`                              | `15 * * * *`   |
| `reconcile-costs`                      | `0 19 * * *`   |
| `reset-periods`                        | `0 20 * * *`   |
| `subscription-lifecycle`               | `30 20 * * *`  |

**Temuan di SaCMS dengan akar yang sama:** cron SaCMS (`publish` tiap 5 menit, `webhook-retry`
tiap 2 menit, `generate-invoices` harian, `cleanup-logs` harian) juga hanya terdaftar di
`vercel.json` milik SaCMS. SaCMS sudah berjalan di Docker di VPS; satu-satunya petunjuk
penjadwalan di repo adalah `scripts/cron-jobs.md` yang meminta crontab dipasang **manual**. Kalau
crontab itu tidak ada di server, **publikasi terjadwal, retry webhook, dan pembuatan invoice
tidak pernah berjalan di production.** Periksa dengan `crontab -l` di VPS.

### CI/CD

Pola yang sama dengan SaCMS: build image dengan build-arg → push ke
`ghcr.io/zonggonau/sacmsapp` → SSH → tulis `/opt/sacms-nocode/.env` dari secret →
`docker compose pull nocode` → `prisma migrate deploy` → `up -d nocode cron` → healthcheck
`curl -sf http://127.0.0.1:3001/api/health`.

### Caddy

```
sacms.cloud {
	reverse_proxy 127.0.0.1:3001 {
		header_up X-Forwarded-Host {host}
		header_up X-Forwarded-Proto {scheme}
	}
}
www.sacms.cloud {
	redir https://sacms.cloud{uri} permanent
}
```

Blok ini **menggantikan** rute apex yang hari ini masih menuju SaCMS. Caddyfile ada di repo
SaCMS dan disinkronkan setiap deploy SaCMS, jadi perubahan ini dirilis bersama rilis SaCMS yang
menjadikan akar `developer.sacms.cloud` halaman login (`RENCANA-FRONTEND.md` §4).

## Enterprise

Tidak ada VPS per workspace. Workspace Enterprise di SaCMS memakai database bersama, object storage
bersama, dan hosting Vercel seperti paket lain — lihat
[ADR-018](./ADR-018-enterprise-di-infrastruktur-bersama.md).

## Risiko yang Harus Diterima

- **Satu VPS menanggung semuanya.** Kedua aplikasi, database bersama, dan API konten publik yang
  dibaca **seluruh** website hasil generate di Vercel. VPS mati = kedua aplikasi mati, dan
  website pengguna tetap tayang tetapi kehilangan konten dan medianya.
- **Trafik website pengguna jatuh ke VPS ini.** Mitigasi:
  - system prompt v0 mewajibkan `fetch` dengan `next: { revalidate }` supaya Vercel menyimpan cache;
  - header cache di API publik SaCMS;
  - nanti, CDN di depan `api.` dan media.
- **Perebutan sumber daya** antara dua aplikasi dan PostgreSQL — dijaga dengan `mem_limit` dan
  ukuran pool.
- **Ops sepenuhnya milik kita:** patch OS, disk penuh, sertifikat, backup yang benar-benar diuji.

## Urutan Kerja

| #   | Repo     | Pekerjaan                                                                                                                                      | Perkiraan        |
| --- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | nocode   | Compose `/opt/sacms-nocode`: service `nocode`, `127.0.0.1:3001`, tanpa mount `src`, `mem_limit`; Dockerfile menerima build-arg `NEXT_PUBLIC_*` | 0,5 hari         |
| 2   | SaCMS    | Database & peran `sacms_nocode`; `db-backup` mencakup `sacms_nocode` + salinan ke luar VPS                                                     | 0,5 hari         |
| 3   | nocode   | Workflow CI deploy ke VPS (GHCR → SSH → migrate → up → healthcheck)                                                                            | 0,5–1 hari       |
| 4   | keduanya | Penjadwal cron di container untuk nocode (9) **dan** SaCMS (4) — ganti `vercel.json`                                                           | 0,5 hari         |
| 5   | nocode   | Shim REST Redis untuk rate limit                                                                                                               | 0,25 hari        |
| 6   | nocode   | Migrasi data Neon → `sacms_nocode`; URL webhook Vercel & callback Google OAuth ke `sacms.cloud`                                                | 0,5 hari         |
| 7   | SaCMS    | Blok Caddy apex → nocode — dirilis saat cutover bersama akar SaCMS = login                                                                     | 0,25 hari        |
|     |          | **Total**                                                                                                                                      | **± 3–3,5 hari** |

## Keputusan yang Dibutuhkan

1. **Spesifikasi VPS `164.68.116.79`** (RAM, vCPU, disk): cukup untuk dua aplikasi, PostgreSQL,
   Redis, dan trafik API dari seluruh website hasil generate?
2. **Ke mana salinan backup dikirim** di luar VPS?
3. **Apakah crontab SaCMS sudah terpasang manual di server?** Kalau belum, cron SaCMS ikut
   dikerjakan di butir 4 sekarang.
