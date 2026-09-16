# ADR-014 — SaCMS di VPS Sendiri, Website Pengguna Tetap di Vercel, Enterprise ke Contabo

**Status:** Diusulkan — menunggu persetujuan pemilik sistem
**Tanggal:** 2026-09-16
**Mengubah sebagian (bila disetujui):** [ADR-003](./ADR-003-postgres-prisma.md) (database di Neon),
[14 §14.1](../14-DEPLOYMENT-GO-LIVE.md) (lingkungan), [14 §14.8](../14-DEPLOYMENT-GO-LIVE.md) (cron)
**Tidak mengubah:** [ADR-008](./ADR-008-terbit-lewat-v0-deployments.md) untuk website yang tetap di
Vercel, [ADR-001](./ADR-001-v0-sebagai-ai-engine.md), [ADR-007](./ADR-007-prisma-driver-adapter.md)
**Terkait:** [ADR-012](./ADR-012-langganan-per-website-dan-dompet-kredit.md) (harga per website)

## Konteks

Hari ini seluruh sistem berdiri di Vercel: aplikasi SaCMS, database Neon, cron Vercel, dan website
hasil pengguna. Pemilik sistem ingin:

1. **Aplikasi SaCMS** berjalan di VPS miliknya sendiri;
2. **Database** memakai PostgreSQL di VPS itu, bukan Neon;
3. **Storage** memakai penyimpanan VPS, bukan Vercel Blob;
4. **Website hasil pengguna tetap di Vercel** untuk paket Standar, Profesional, dan Bisnis,
   tetapi **storage asetnya di VPS SaCMS**;
5. **Paket Enterprise**: website yang ingin berdiri sendiri diambil kodenya dari v0, didorong ke
   GitHub milik SaCMS, lalu di-`git clone` dan dijalankan di VPS Contabo.

Pemeriksaan kode hari ini (bukan dugaan):

| Temuan                                                                                                          | Artinya untuk pindah ke VPS                   |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Tidak ada satu pun impor `@vercel/*` di `src`; `BLOB_READ_WRITE_TOKEN` opsional dan belum dipakai               | Pindah storage hampir tanpa biaya kode        |
| `@prisma/adapter-pg` portabel, dev sudah memakai Postgres lokal ([ADR-007](./ADR-007-prisma-driver-adapter.md)) | Pindah database rendah risiko                 |
| **9 cron** terdaftar di `vercel.json`                                                                           | Harus diganti penjadwal sistem di VPS         |
| `lib/ratelimit` memakai Upstash **REST**                                                                        | VPS perlu Redis + shim REST, atau ganti klien |
| `next.config.ts` belum memakai `output: "standalone"`                                                           | Perlu ditambah untuk dijalankan sendiri       |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_WEBHOOK_SECRET` dipakai mengelola website **pengguna**                | Tetap dibutuhkan, tidak ikut pindah           |
| **Belum ada integrasi GitHub sama sekali** (tanpa klien, tanpa token, tanpa env)                                | Jalur Enterprise butuh `lib/github` baru      |

## Keputusan (diusulkan)

### 1. Aplikasi SaCMS pindah ke VPS

- `next.config.ts` memakai `output: "standalone"`; aplikasi dijalankan sebagai layanan systemd di
  belakang reverse proxy (Caddy atau Nginx) yang mengurus HTTPS.
- Deploy tetap **hanya dari CI** ([14 §14.1](../14-DEPLOYMENT-GO-LIVE.md)): CI membangun, lalu
  mengirim hasilnya ke VPS lewat SSH (atau image container yang di-`pull` VPS). Tidak ada deploy
  dari laptop siapa pun.
- Sembilan cron Vercel menjadi **systemd timer** yang memanggil endpoint HTTP yang sama dengan
  header `Authorization: Bearer $CRON_SECRET`. Endpoint-nya tidak berubah sama sekali.

### 2. Database & storage platform di VPS

- PostgreSQL di VPS; `DATABASE_URL` dan `DIRECT_URL` menunjuk ke sana. Prisma tidak berubah.
- **Pencadangan wajib ada sebelum pindah**: `pg_dump` terjadwal + salinan ke luar VPS, dan
  pemulihan diuji sekali sungguhan. Ini menggantikan PITR Neon yang hilang.
- Storage aset platform memakai disk VPS lewat satu lapisan `lib/storage` (atau MinIO bila ingin
  S3-compatible). Karena `@vercel/blob` belum pernah dipakai, tidak ada kode yang perlu dibongkar.
- Redis di VPS untuk rate limit, dengan shim REST (`hiett/serverless-redis-http`) agar
  `lib/ratelimit` tidak berubah.

### 3. Hosting website pengguna ditentukan paketnya

| Paket                            | Website di-hosting | Storage aset website | Jalur penerbitan                                                              |
| -------------------------------- | ------------------ | -------------------- | ----------------------------------------------------------------------------- |
| **Standar, Profesional, Bisnis** | Vercel (tetap)     | **VPS SaCMS**        | `v0.deployments.create` ([ADR-008](./ADR-008-terbit-lewat-v0-deployments.md)) |
| **Enterprise**                   | VPS Contabo        | VPS Contabo          | v0 → GitHub → `git clone` di Contabo                                          |

Untuk tiga paket pertama tidak ada perubahan jalur terbit: beban trafik pengunjung tetap di Vercel,
bukan di VPS SaCMS. Yang berpindah hanya **storage aset** (gambar dan dokumen yang diunggah): berkas
disimpan di VPS SaCMS dan disajikan lewat satu alamat publik, lalu dipakai website di Vercel.

Konsekuensi yang harus diterima untuk pilihan storage ini:

- **Bandwidth gambar jatuh ke VPS SaCMS**, bukan ke CDN Vercel. Untuk situs yang ramai, ini bagian
  biaya dan risiko yang perlu dipantau; bila terasa, di depannya dipasang CDN.
- VPS SaCMS menjadi jalur kritis bagi tampilan website pelanggan: VPS mati berarti gambar hilang
  meski situsnya sendiri tetap tayang di Vercel.
- CSP `img-src` pada website hasil harus mengizinkan alamat storage tersebut.

> **Nama paket.** Empat nama di atas (Standar, Profesional, Bisnis, Enterprise) **menggantikan**
> segmen UMKM dan Instansi & Pemda di [ADR-012](./ADR-012-langganan-per-website-dan-dompet-kredit.md).
> Harga tiap paket belum diputuskan dan tidak diputuskan di ADR ini — lihat "Keputusan yang
> Dibutuhkan dari Pemilik".

### 4. Paket Enterprise: v0 → GitHub → Contabo

```
Builder selesai
  → ambil kode versi dari v0
  → push ke repositori GitHub milik SaCMS (satu repo per project)
  → VPS Contabo: git clone / git pull
  → build & jalankan (Docker + Postgres + reverse proxy)
  → SaCMS mencatat status dan alamatnya
```

- Repo per project, privat, nama `sacms-<slug>-<id pendek>`.
- Integrasi GitHub dibungkus di **`lib/github`** (aturan ACL docs 02 §2.2), env baru
  `GITHUB_TOKEN` dan `GITHUB_OWNER`.
- Deploy ke Contabo lewat lapisan `lib/vps` yang memanggil agen di VPS itu (atau Coolify/Dokploy
  bila ingin tanpa menulis agen sendiri).
- **Hanya untuk paket Enterprise**, karena setiap website menuntut sumber daya dan perawatan
  sendiri. Harganya dihitung ulang di ADR-012 (perkiraan awal: VPS Rp 150–400 rb/bulan per
  pelanggan, harga jual Rp 25–50 juta/tahun — belum dihitung rinci).

**Yang masih harus diverifikasi sebelum dibangun:** cara mengambil berkas sumber satu versi dari
v0. Tipe SDK menunjukkan bentuk `files` dan `zip`, tetapi metode pastinya belum saya konfirmasi.
Bila v0 tidak menyediakannya, jalur pengganti adalah integrasi v0 → GitHub milik v0 sendiri, lalu
SaCMS mengambil dari repo itu.

## Yang Berubah di Kode & Operasi

| Area               | Perubahan                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `next.config.ts`   | `output: "standalone"`                                                                              |
| Baru `lib/storage` | Aset platform DAN aset website pengguna (disk VPS / MinIO) + satu alamat publik untuk menyajikannya |
| Baru `lib/github`  | Buat repo, push kode versi, baca status                                                             |
| Baru `lib/vps`     | Perintah deploy ke VPS Contabo (clone/pull, build, restart)                                         |
| `deploy.service`   | Bercabang menurut target: `VERCEL` (sekarang) atau `VPS` (Enterprise)                               |
| `Project`          | Kolom target hosting + pengenal repo & host                                                         |
| Cron               | `vercel.json` tidak lagi dipakai; sembilan endpoint dipanggil systemd timer                         |
| `docs/14`          | Tabel lingkungan & cron ditulis ulang untuk VPS                                                     |
| Ops baru           | Pencadangan Postgres + uji pemulihan, pemantauan VPS, pembaruan keamanan OS, sertifikat             |

## Risiko yang Harus Diterima

- **Satu titik kegagalan.** Vercel dan Neon mengurus ketersediaan, cadangan, dan skala. Di VPS,
  itu semua menjadi tanggung jawab kita — termasuk saat VPS mati di jam sibuk.
- **Kehilangan PITR Neon.** Tanpa pencadangan terjadwal yang **sudah diuji**, satu kesalahan
  migrasi bisa berarti kehilangan data permanen.
- **Perawatan berkelanjutan**: patch OS, sertifikat, disk penuh, log rotation.
- **Jalur Enterprise menambah vendor dan tanggung jawab** (GitHub + Contabo), dan mengeluarkan
  website itu dari perlindungan [ADR-008](./ADR-008-terbit-lewat-v0-deployments.md).
- **Trafik pengunjung** website Enterprise jatuh ke VPS Contabo, bukan CDN Vercel.

## Alternatif yang Dipertimbangkan

| Alternatif                                   | Kelebihan                                                               | Kekurangan                                                 | Alasan                            |
| -------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| Tetap sepenuhnya di Vercel + Neon            | Tanpa kerja ops; cadangan & skala terurus                               | Biaya tetap vendor; kendali terbatas                       | Pemilik ingin kendali & biaya VPS |
| **SaCMS di VPS, website pengguna di Vercel** | Kendali penuh, biaya tetap rendah, trafik pelanggan tidak membebani VPS | Ops menjadi tanggung jawab sendiri                         | **Diusulkan**                     |
| Semua (termasuk website pengguna) di VPS     | Satu tempat                                                             | Trafik pengunjung membebani VPS; kehilangan CDN & jalur v0 | Ditolak                           |
| Enterprise tanpa GitHub (rsync langsung)     | Lebih sedikit vendor                                                    | Tanpa riwayat versi, tanpa rollback, sulit diaudit         | Ditolak                           |

## Konsekuensi

**Positif:** biaya vendor turun dan bisa diperkirakan; kendali penuh atas data; paket Enterprise
menjadi mungkin dijual; pelanggan memegang kodenya sendiri di GitHub.

**Negatif:** SaCMS berubah menjadi pekerjaan operasional, bukan hanya pekerjaan produk; sebelum
pindah, pencadangan dan pemantauan harus benar-benar jalan, bukan sekadar direncanakan.

## Tahap Pengerjaan (setelah disetujui)

| Tahap | Isi                                                                                | Perkiraan    |
| ----- | ---------------------------------------------------------------------------------- | ------------ |
| 1     | `output: standalone`, systemd + reverse proxy, CI deploy lewat SSH, staging di VPS | 1,5 hari     |
| 2     | Postgres VPS + Redis + shim REST, migrasi data, **cadangan & uji pemulihan**       | 1,5 hari     |
| 3     | `lib/storage` dan pemindahan aset platform                                         | 0,5 hari     |
| 4     | Sembilan cron menjadi systemd timer + pemantauan kegagalannya                      | 0,5 hari     |
| 5     | Enterprise: `lib/github`, repo per project, ambil kode dari v0                     | 2 hari       |
| 6     | Enterprise: `lib/vps` + target hosting di `deploy.service` + UI admin              | 2 hari       |
| 7     | Revisi docs 02, 03, 14; E2E jalur Enterprise                                       | 1 hari       |
|       | **Total**                                                                          | **± 9 hari** |

## Keputusan yang Dibutuhkan dari Pemilik

1. Setuju memindahkan aplikasi, database, dan storage ke VPS, dengan konsekuensi ops di atas?
2. Spesifikasi dan lokasi VPS SaCMS (RAM, disk, wilayah) — dan apakah staging ikut di VPS yang sama?
3. Rencana cadangan: ke mana salinan `pg_dump` disimpan di luar VPS?
4. Akun GitHub (organisasi) untuk repo pelanggan, dan apakah pelanggan diberi akses ke repo-nya.
5. Nama dan harga keempat paket (Standar, Profesional, Bisnis, Enterprise) — menggantikan segmen
   UMKM dan Instansi & Pemda di ADR-012, termasuk berapa harga Enterprise.
6. Apakah storage aset website cukup di VPS SaCMS tanpa CDN di depannya untuk saat ini.

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Waktu yang terpakai untuk merawat VPS melebihi nilai penghematannya.
- Terjadi kehilangan data atau downtime panjang yang tidak tertolong oleh cadangan.
- Vercel atau Neon mengubah harga sehingga perhitungan ini berubah arah.
