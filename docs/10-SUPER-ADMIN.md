# 10 — Panel Super Admin (Pemilik Sistem)

## 10.1 Untuk Apa Panel Ini Ada

Bukan "dashboard admin yang bagus". Panel ini menjawab empat pertanyaan yang, kalau tidak
terjawab, membuat pemilik kehilangan kendali atas produknya sendiri:

1. **Berapa biaya yang sedang saya keluarkan, dan siapa yang menghabiskannya?**
2. **Kenapa build pengguna ini gagal?** (tanpa harus membuka log Vercel)
3. **Bagaimana saya menghentikan sesuatu yang sedang berjalan buruk — sekarang juga?**
4. **Siapa melakukan apa, kapan?**

Setiap layar di bawah ada untuk menjawab salah satunya.

## 10.2 Perbedaan Visual — Wajib

Panel admin **harus terlihat berbeda** dari aplikasi pengguna, supaya Super Admin tidak
pernah bingung sedang berada di mana:

- Sidebar berlatar `#0A0A0A` dengan garis kiri oranye penuh.
- Chip `SUPER ADMIN` permanen di topbar (badge varian `default` — hitam di atas oranye).
- Saat **impersonasi**: banner oranye penuh lebar menetap di seluruh halaman.
- Saat **maintenance mode** aktif: banner merah di topbar admin.

## 10.3 `/admin` — Ringkasan Sistem

```
+---------------------------------------------------------------------------+
|  Ringkasan Sistem                            [SUPER ADMIN]   14 Sep 2026   |
+---------------------------------------------------------------------------+
|  Pengguna       Project        Build hari ini      Kredit terpakai (bln)   |
|    1.284          3.107         412 / 38 gagal        18.430 / 50.000      |
|   +42 (7h)       +118 (7h)      tingkat sukses 91%    [=========-----] 37% |
+---------------------------------------------------------------------------+
|  Estimasi biaya AI bulan ini                                              |
|    Rp 4.812.000    (proyeksi akhir bulan: Rp 10.310.000)                   |
|    Ambang peringatan: Rp 12.000.000   [Ubah ambang]                        |
+---------------------------------------------------------------------------+
|  PERLU PERHATIAN                                                          |
|   [!] 6 build gagal dalam 1 jam terakhir          -> Lihat                 |
|   [!] 2 job berjalan lebih dari 10 menit          -> Lihat                 |
|   [!] Pengguna "rizal@..." memakai 890 kredit     -> Lihat                 |
+---------------------------------------------------------------------------+
|  KENDALI CEPAT                                                            |
|   Kill switch AI      [ MATI ]  <- generate global                         |
|   Maintenance mode    [ MATI ]  <- hanya admin bisa masuk                  |
|   Pendaftaran baru    [ AKTIF ]                                            |
+---------------------------------------------------------------------------+
```

Blok "Perlu Perhatian" muncul **hanya bila ada isinya**. Panel yang selalu penuh
peringatan akan diabaikan.

> **Fase 5:** estimasi biaya AI dan proyeksinya **belum** ditampilkan — angkanya berasal dari
> rekonsiliasi biaya vendor di Fase 6. Menampilkan angka karangan lebih buruk daripada
> tidak menampilkannya. Pemakai kredit terbesar muncul di "Perlu Perhatian" bila ≥ 90% kuota.

## 10.4 `/admin/pengguna`

Tabel: Nama & email · Paket · Project · Kredit terpakai · Status · Terakhir masuk.
Filter: paket, status, peran. Pencarian: nama/email. Semua filter lewat `nuqs` (URL).

### `/admin/pengguna/[userId]` — halaman investigasi

Tiga kolom informasi + panel tindakan:

```
Profil                Pemakaian                    Tindakan
------                ---------                    --------
Nama, email           Kredit: 412 / 500            [Ubah Paket]
Terdaftar             Project: 7 / 10              [Atur Kuota Manual]
Terakhir masuk        Deploy hari ini: 4 / 30      [Reset Pemakaian]
Peran, Status         Biaya vendor bulan ini       [Tangguhkan Akun]
Verifikasi email      Grafik 30 hari               [Ubah Peran]
                                                   [Masuk sebagai Pengguna]
                                                   [Hapus Permanen]

Project milik pengguna (tabel, dapat diklik ke detail admin)
Build terakhir (10, dengan status & durasi)
Riwayat audit yang menyangkut pengguna ini
```

Aturan tindakan:

| Tindakan               | Konfirmasi                   | Efek samping                                                          |
| ---------------------- | ---------------------------- | --------------------------------------------------------------------- |
| Ubah Paket             | Dialog biasa                 | Kuota berlaku segera; audit                                           |
| Atur Kuota Manual      | Dialog biasa                 | Mengisi `creditsOverride`; audit                                      |
| Reset Pemakaian        | Dialog biasa                 | `creditsUsed=0`, `periodStartedAt=now`; audit                         |
| Tangguhkan             | Dialog + **alasan wajib**    | Semua sesi dicabut seketika; email ke pengguna; audit                 |
| Ubah Peran             | Dialog                       | Sesi dicabut; **ditolak** bila menurunkan Super Admin terakhir; audit |
| Masuk sebagai Pengguna | Dialog menyebut nama & email | Sesi impersonasi 60 menit; audit mulai & selesai                      |
| Hapus Permanen         | **Ketik email persis**       | Hard delete; `AuditLog` & `UsageEvent` tetap tinggal; audit           |

## 10.5 `/admin/project` dan `/admin/build`

**Project** — semua project lintas pengguna. Filter status, tipe, pemilik.
Detail admin menampilkan yang tidak dilihat pengguna: `v0ChatId`, `vercelProjectId`,
seluruh riwayat versi, total kredit yang dihabiskan project ini.

**Build** — pusat pemecahan masalah:

```
/admin/build?status=FAILED

Job                Pengguna         Project          Status   Durasi   Attempt
b_9f2a...          rizal@...        Website Desa     FAILED   1m 12s   3/3
b_7c81...          maria@...        Toko Kopi        RUNNING  9m 40s   1/3   [!]
```

`/admin/build/[jobId]`:

- Timeline 10 langkah dengan durasi masing-masing — langsung terlihat langkah mana yang
  lambat atau gagal.
- **`rawError` lengkap** (hanya di sini; pengguna tidak pernah melihatnya).
- Prompt yang benar-benar dikirim ke v0, **termasuk system prompt**.
- `correlationId` dengan tombol salin, untuk dicocokkan dengan log Sentry/Vercel.
- Tombol **Batalkan** (job berjalan) dan **Ulangi** (job gagal).

Halaman ini adalah alasan utama seseorang membuka panel admin. Buat halaman ini dengan baik.

## 10.6 `/admin/paket` — Plan sebagai Data, Bukan Kode

Batas kuota disimpan di tabel `Plan`, bukan di konstanta. Artinya Super Admin dapat
mengubah "Pro dari 500 menjadi 750 kredit" **tanpa deploy**.

```
Paket      Harga/bln    Project   Kredit   Domain   Deploy/hari   Pengguna
Free       Rp 0            1        30        0          3         1.102
Pro        Rp 149.000     10       500        3         30           171
Business   Rp 499.000     50     3.000       25        200            11
```

Aturan: menurunkan batas **tidak** langsung memutus pengguna yang sudah melewatinya.
Mereka hanya tidak bisa membuat yang baru. Memutus akses ke pekerjaan yang sudah ada
adalah cara cepat kehilangan pelanggan.

## 10.7 `/admin/ai` — Kendali Mesin

> **Berubah oleh [ADR-011](./adr/ADR-011-ikuti-perilaku-bawaan-v0.md):** editor system prompt dan
> pilihan model default dihapus dari panel. Semua build memakai `v0-auto` tanpa system prompt
> SaCMS; panel hanya menampilkan kill switch dan ringkasan kebijakan. `BuildJob.sentMessage` dan
> `model` tetap dicatat; `systemPrompt` kini selalu kosong.

| Kendali                         | Efek                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Kill switch generate**        | Semua build baru ditolak; job berjalan diselesaikan. Pengguna melihat pesan pemeliharaan yang sopan |
| Model default                   | Model v0 yang dipakai untuk build baru                                                              |
| Model per paket                 | Paket lebih tinggi boleh model lebih kuat                                                           |
| Editor system prompt            | Ubah aturan dasar. **Wajib versi + pratinjau + audit**                                              |
| Editor template tipe website    | Ubah daftar `requirements` per tipe                                                                 |
| Batas percobaan ulang & timeout | —                                                                                                   |
| Ambang biaya harian             | Melewati ambang → kill switch **otomatis** menyala + notifikasi                                     |

> Editor system prompt adalah kendali paling tajam di sistem ini. Perubahan buruk merusak
> **semua** hasil generate berikutnya. Karena itu: simpan versi lama, tampilkan diff
> sebelum menyimpan, catat ke audit, dan sediakan tombol "Kembalikan ke versi sebelumnya".

**Implementasi Fase 5:**

- Yang bisa diedit hanya **blok ATURAN**. Kerangka teknologi, spesifikasi, serta pembatas dan
  label DATA untuk prompt pengguna dikunci di kode (`lib/v0/system-prompt.ts`) — satu salah
  ketik di sana membuka sistem terhadap prompt injection. Aturan yang memuat penanda
  `PERMINTAAN_PENGGUNA` ditolak.
- Riwayat disimpan append-only di `SystemSetting["ai.systemPromptRules"]` (maks 30 versi).
  "Kembalikan" menyalin versi lama sebagai versi baru; tidak ada versi yang ditimpa.
- System prompt dan pesan yang benar-benar terkirim disimpan per job (`BuildJob.systemPrompt`,
  `sentMessage`, `model`) sehingga detail build tetap jujur setelah aturan diubah.
- **Ditunda** (lihat BACKLOG): editor template tipe website, batas percobaan ulang & timeout
  dari UI, ambang biaya harian + kill switch otomatis (butuh data biaya Fase 6).

## 10.8 `/admin/sistem` dan `/admin/audit`

**Sistem** — maintenance mode (hanya admin bisa masuk, pengguna lain melihat halaman
pemberitahuan), aktif/nonaktifkan pendaftaran, feature flag, status integrasi
(v0 / Vercel / Resend / Upstash — tombol "Uji Koneksi" untuk masing-masing).

**Audit** — daftar append-only. Filter: pelaku, aksi, jenis target, rentang tanggal.
Tiap baris dapat diperluas untuk melihat `before` dan `after` berdampingan.

Aturan audit:

- **Tidak ada tombol hapus.** Tidak ada di UI, tidak ada di Server Action.
- Yang dicatat: **semua** aksi admin, perubahan peran/status/paket, kill switch,
  maintenance, perubahan system prompt, mulai/selesai impersonasi, login gagal
  berulang, dan hard delete.
- Retensi minimal 12 bulan.
- Dapat diekspor CSV (`/admin/audit/ekspor`, maks 10.000 baris per unduhan, sel diamankan
  dari CSV injection). Ekspor itu sendiri tercatat sebagai `admin.audit.export`.

**Fase 5:** halaman Sistem menampilkan mode setiap integrasi (nyata / tiruan / belum
diatur) dari konfigurasi. Tombol "Uji Koneksi" langsung ke vendor dan feature flag
ditunda ke BACKLOG.

## 10.9 Aturan Keamanan Panel Admin

1. Seluruh `(admin)` dilindungi `requireSuperAdmin()` **di layout grup** — bukan per halaman.
2. Setiap action admin membawa `metadata.requireRole` dan `metadata.audit: true`.
   Action admin tanpa `audit: true` adalah bug, dan lint kustom harus menolaknya.
3. `/admin` wajib `robots: { index: false }`.
4. Peran **tidak pernah** dibaca dari klien; selalu dari sesi server.
5. Rute admin tidak pernah di-cache.
6. Tindakan destruktif memakai **konfirmasi ketik-untuk-yakin**, bukan sekadar "Anda yakin?".
7. Pertimbangkan mewajibkan 2FA untuk `SUPER_ADMIN` di v1.1.

## 10.10 Struktur Navigasi Admin

```
Ringkasan          /admin
Pengguna           /admin/pengguna
Project            /admin/project
Build              /admin/build
Paket              /admin/paket
AI & Model         /admin/ai
Sistem             /admin/sistem
Audit Log          /admin/audit
---------------------------------
Kembali ke Aplikasi  /dashboard
```

Item nav aktif memakai pola oranye dari [04 §4.7](./04-DESIGN-SYSTEM.md).

## 10.11 Peran `ADMIN` (staf pendukung)

Ada di skema sejak awal, tetapi UI-nya **baru dikerjakan di v1.1**. Yang penting sekarang:
pemeriksaan peran ditulis sebagai `requireRole([...])` dengan daftar, bukan
`if (role === "SUPER_ADMIN")`. Dengan begitu menambahkan `ADMIN` nanti tidak berarti
menyisir ulang seluruh basis kode.

Batas `ADMIN` saat diaktifkan: baca semuanya, boleh tangguhkan pengguna dan
batalkan/ulangi build. **Tidak** boleh: ubah paket, ubah peran, impersonasi, kill switch,
system prompt, hard delete.
