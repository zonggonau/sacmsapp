# Backlog — Ide di Luar Fase Berjalan

> **Kenapa berkas ini ada.** Ide bagus yang muncul di tengah fase adalah penyebab paling
> umum proyek keluar jalur. Tulis di sini, lanjutkan pekerjaan yang sedang berjalan.
> Setiap akhir fase, isi berkas ini ditinjau dan diputuskan: kerjakan, jadwalkan, atau buang.

## Cara Menulis Entri

```markdown
### [Judul singkat]

- **Ditemukan saat:** Fase N, tanggal
- **Masalah nyata yang diselesaikan:** (kalau tidak ada, jangan ditulis)
- **Perkiraan usaha:** jam / hari
- **Target versi usulan:** v1.1 / v1.2 / v2.0 / buang
```

Entri tanpa "masalah nyata" adalah keinginan, bukan kebutuhan. Jangan dicatat.

---

## Belum Ditinjau

### Terapkan brand PACE AI di produk (UI, logo, domain, email)

- **Ditemukan saat:** Fase 7, 2026-09-15
- **Masalah nyata yang diselesaikan:** identitas brand sudah ditetapkan di
  [01 §1.0](./01-VISI-DAN-SCOPE.md) — **PACE AI**, _Born in Papua. Built for the World._ —
  tetapi layar, metadata halaman, email transaksional, dan domain masih menampilkan "SaCMS".
  Pengguna dan penguji beta akan melihat dua nama berbeda.
- **Perkiraan usaha:** 0,5–1 hari untuk teks UI, metadata, email, halaman legal, dan uji E2E;
  logo & domain bergantung pada aset dan pembelian domain.
- **Target versi usulan:** **sebelum go-live** (Fase 7) bila pemilik memutuskan brand tampil
  sejak peluncuran — nama kode `sacms` di repositori tidak perlu diganti.

### Tangkapan layar panduan DNS per penyedia

- **Ditemukan saat:** Fase 4, 2026-09-15
- **Masalah nyata yang diselesaikan:** docs/09 §9.10 meminta panduan bergambar; yang ada
  baru langkah tertulis. Pengguna awam paling sering menyerah di langkah DNS.
- **Perkiraan usaha:** 0,5 hari (butuh akun di tiap penyedia)
- **Target versi usulan:** v1.1

### Pengalihan otomatis www ↔ domain utama

- **Ditemukan saat:** Fase 4, 2026-09-15
- **Masalah nyata yang diselesaikan:** pengguna harus menambahkan `www.domain` dan `domain`
  satu per satu; pengunjung yang mengetik varian lain tidak sampai.
- **Perkiraan usaha:** 0,5 hari (Vercel mendukung `redirect` pada domain project)
- **Target versi usulan:** v1.1

### Sisa isi docs/10 yang ditunda dari Fase 5

- **Ditemukan saat:** Fase 5, 2026-09-15
- **Masalah nyata yang diselesaikan:** DoD Fase 5 terpenuhi tanpa butir ini, tetapi docs/10
  menyebutnya:
  - Editor template tipe website (`requirements` per tipe) dari UI
  - Batas percobaan ulang & timeout build dari UI
  - Tombol "Uji Koneksi" langsung ke v0 / Vercel / Resend / Upstash
  - Feature flag
  - Grafik pemakaian 30 hari di halaman investigasi pengguna
  - Estimasi & ambang biaya + kill switch otomatis (bergantung rekonsiliasi biaya Fase 6)
- **Perkiraan usaha:** 2–3 hari total
- **Target versi usulan:** biaya → Fase 6; sisanya v1.1

---

## Selesai

> Entri yang sudah dikerjakan tetap dicatat di sini agar jejak keputusannya tidak hilang.

### Sisa tampilan kuota dari docs/11 §11.6

- **Ditemukan saat:** Fase 6, 2026-09-15
- **Masalah nyata yang diselesaikan:** notifikasi `quota.low` dan `cost.threshold` sudah
  dibuat di database tetapi belum ada daftar notifikasi di UI; sisa kredit belum tampil di
  dialog buat project; tombol yang kuotanya habis belum dinonaktifkan dengan tooltip (saat ini
  ditolak saat diklik dengan pesan + tombol Lihat Paket).
- **Perkiraan usaha:** 1 hari
- **Target versi usulan:** Fase 7 atau v1.1
- **Sebagian selesai 2026-09-16:** halaman `/akun/notifikasi` + lonceng dengan jumlah belum dibaca di topbar. Tersisa: sisa kredit di dialog buat project dan tombol nonaktif + tooltip saat kuota habis → v1.1.
- **Selesai 2026-09-16:** sisa kredit di bawah tombol Buat Project; tombol Bangun Sekarang, kirim chat, Terbitkan, dan Buat Project nonaktif dengan tooltip + tautan Lihat Paket (`tests/services/penghalang-kuota.test.ts`, E2E alur 4).

### Status HTTP 404 untuk project yang tidak dimiliki

- **Ditemukan saat:** Fase 5 (uji 07 §7.8), 2026-09-15
- **Masalah nyata yang diselesaikan:** `/projects/{id-milik-orang-lain}` menampilkan halaman
  "tidak ditemukan" tanpa data apa pun dan dengan `noindex`, tetapi status HTTP-nya **200**:
  `projects/loading.tsx` membuat Suspense boundary sehingga respons sudah mulai dialirkan
  sebelum `notFound()` dipanggil. Keberadaan project tidak terkonfirmasi, jadi tujuan butir
  keamanannya terpenuhi; status yang benar tetap penting untuk pemantauan.
- **Perkiraan usaha:** 0,5 hari (pindahkan pemeriksaan kepemilikan sebelum boundary, atau
  pisahkan loading daftar project ke route group sendiri; uji ulang builder/deployment/domain)
- **Target versi usulan:** Fase 7 (hardening)
- **Selesai 2026-09-16:** daftar project dipindah ke route group `(daftar)` dan tab builder/deployment/domain memeriksa kepemilikan sebelum batas Suspense; kelima tab membalas 404 sungguhan (`e2e/06-dod-fase-1-3.spec.ts`).

### Hapus project harus menurunkan website yang sudah tayang

- **Ditemukan saat:** Fase 4, 2026-09-15
- **Masalah nyata yang diselesaikan:** sejak Fase 4 penerbitan sungguhan, menghapus project
  di SaCMS **tidak** menghapus project Vercel buatan v0 — website dan custom domain-nya tetap
  bisa diakses. Dialog hapus project (Fase 2) menjanjikan sebaliknya.
- **Perkiraan usaha:** 0,5–1 hari (putuskan: hapus project v0/Vercel saat purge, atau
  lepas domain + nonaktifkan saat soft delete; perlu uji nyata)
- **Target versi usulan:** **wajib sebelum go-live** (Fase 7) — atau lebih awal bila pemilik memutuskan
- **Selesai 2026-09-16:** hapus project dan hapus pengguna melepas custom domain lalu menghapus project Vercel sebelum data ditandai terhapus; bila vendor gagal, penghapusan dibatalkan (`deploy.service.takeDown`, uji `tests/services/sisa-fase.test.ts`).

### Penjadwal cron production

- **Ditemukan saat:** Fase 6, 2026-09-15
- **Masalah nyata yang diselesaikan:** tujuh endpoint cron ada tetapi belum terjadwal.
  Vercel Hobby hanya mengizinkan cron harian; jadwal per menit membuat deploy ditolak.
- **Perkiraan usaha:** 2 jam setelah keputusan (Vercel Pro vs penjadwal eksternal)
- **Target versi usulan:** Fase 7 — wajib sebelum go-live
- **Selesai 2026-09-16:** tim Vercel Pro; delapan jadwal di `vercel.json` ([14 §14.8](./14-DEPLOYMENT-GO-LIVE.md)).

### Audit akhir impersonasi yang kedaluwarsa sendiri

- **Ditemukan saat:** Fase 5, 2026-09-15
- **Masalah nyata yang diselesaikan:** `user.impersonate.end` hanya tercatat bila admin
  menekan "Kembali ke akun saya". Sesi yang habis sendiri setelah 60 menit tidak meninggalkan
  catatan akhir.
- **Perkiraan usaha:** 2 jam (cron cleanup mencatat sesi impersonasi yang kedaluwarsa)
- **Target versi usulan:** Fase 7
- **Selesai 2026-09-16:** cron `/api/cron/cleanup` mencatat `user.impersonate.expired` sekali lalu menghapus sesinya.

---

## Sudah Dijadwalkan

Ini yang sudah diputuskan sejak perancangan awal
([01 §1.6](./01-VISI-DAN-SCOPE.md), [13 §13.4](./13-ROADMAP-DAN-FASE.md)):

### v1.1

- Workspace & kolaborasi tim — jalur migrasi di [ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md)
- Pembayaran otomatis (Midtrans) — rencana di [11 §11.7](./11-QUOTA-DAN-BILLING.md),
  penyedia dikunci [ADR-010](./adr/ADR-010-pembayaran-midtrans.md)
- UI untuk peran `ADMIN` (staf pendukung) — batasan di [10 §10.11](./10-SUPER-ADMIN.md)
- 2FA wajib untuk `SUPER_ADMIN`

### v1.2

- Marketplace template
- i18n multi-bahasa — kesiapan sudah diatur di [05 §5.10](./05-STRUKTUR-APLIKASI.md)
- Analitik pengunjung untuk situs hasil pengguna

### v2.0

- CMS bawaan SaCMS (content type builder, media library)
- MCP server SaCMS
- API publik + aplikasi mobile — akan memakai service layer yang sama
  ([ADR-004](./adr/ADR-004-server-actions-first.md))
- Editor kode / file tree

---

## Ditolak

| Ide                                   | Alasan ditolak                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Workspace personal tersembunyi di MVP | Membayar seluruh ongkos kompleksitas tanpa menerima manfaatnya ([ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md)) |
| SSE sejak MVP                         | Polling cukup untuk proses 2–4 menit; ditunda ke Fase 7 ([ADR-005](./adr/ADR-005-build-job-polling.md))          |
| Queue eksternal (Inngest/BullMQ)      | Berlebihan untuk skala awal ([ADR-005](./adr/ADR-005-build-job-polling.md))                                      |
| Membangun AI engine sendiri           | Berbulan-bulan kerja riset tanpa keunggulan ([ADR-001](./adr/ADR-001-v0-sebagai-ai-engine.md))                   |
| CSP ketat sejak Fase 0                | Tim akan terbiasa melonggarkannya; dipasang di Fase 7 ([12 §12.3](./12-KEAMANAN.md))                             |
