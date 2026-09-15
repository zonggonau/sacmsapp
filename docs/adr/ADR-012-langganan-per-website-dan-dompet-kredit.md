# ADR-012 — Paket per Project & Dompet Kredit AI per Akun

**Status:** Diusulkan — menunggu persetujuan pemilik sistem
**Tanggal:** 2026-09-16
**Menggantikan (bila disetujui):** [11 §11.1, §11.2, §11.5](../11-QUOTA-DAN-BILLING.md) (paket per akun
dengan kredit bulanan)
**Terkait:** [ADR-010](./ADR-010-pembayaran-midtrans.md), [ADR-011](./ADR-011-ikuti-perilaku-bawaan-v0.md)

## Konteks

Model sekarang ([11](../11-QUOTA-DAN-BILLING.md)): **paket melekat ke akun** (Free / Pro / Business)
dengan harga bulanan, batas jumlah project, dan **kredit AI bulanan yang di-reset** setiap 30 hari.

Pemilik sistem menginginkan model yang lebih mudah dijual ke UMKM dan Pemda:

1. **1 website = 1 paket** berlangganan **tahunan** dengan **layanan lengkap** dan satu harga.
2. **AI generate tidak termasuk paket.** Kredit AI dibeli terpisah (top-up) kapan saja oleh masing-masing
   pelanggan.

Data biaya nyata akun v0 (9 Agu – 15 Sep 2026, 110 generate, 36 website): rata-rata **Rp 6.900 per
generate**, median Rp 2.800, 90% di bawah Rp 25.100, tertinggi Rp 50.600 (kurs Rp 17.700/USD). Setelah
ADR-011 semua build memakai `v0-auto`, sehingga variasi biaya per generate besar.

## Keputusan (diusulkan)

**Prinsip:** biaya dipisah menurut **apa yang menimbulkannya**.

| Yang dibayar           | Melekat pada | Alasan                                                                                              |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| **Paket Project**      | 1 project    | Setiap project memakai sumber daya sendiri: database Neon, storage, function, bandwidth, domain     |
| **Kredit AI (top-up)** | Akun         | Biaya v0 timbul saat membuat/mengubah, bukan saat situs tayang — bisa dipakai di semua project akun |

### 1. Paket Project — per project, tahunan

Setiap project yang **diterbitkan** membutuhkan satu Paket Project aktif. Satu project mendapat
**sumber daya terisolasi miliknya sendiri**, sehingga biayanya bisa dihitung dan dibatasi per project.

| Sumber daya per project        | Layanan                                        | Batas wajar UMKM                            | Batas wajar Pemda            |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Hosting & CDN + HTTPS          | Vercel (project Vercel sendiri)                | 50 GB transfer/bulan                        | 300 GB transfer/bulan        |
| Function (server, API, form)   | Vercel Functions                               | 500 rb pemanggilan/bulan                    | 3 jt pemanggilan/bulan       |
| Database                       | Neon Postgres (1 database Neon per project)    | 1 GB                                        | 10 GB                        |
| Storage file (gambar, dokumen) | Vercel Blob (1 store per project)              | 5 GB                                        | 50 GB                        |
| Domain                         | 1 custom domain + `www`; alamat bawaan         | Domain .com/.id didaftarkan untuk pelanggan | Domain .go.id milik instansi |
| Penerbitan, versi & rollback   | Terbit ulang (maks 30/hari), rollback, runbook | ✓                                           | ✓                            |
| Cadangan & pemantauan          | PITR Neon, pemantauan ketersediaan             | 7 hari                                      | 30 hari                      |
| Dukungan                       | Email/WhatsApp                                 | Jam kerja                                   | Prioritas + SLA              |
| **Tidak termasuk**             | **Kredit AI untuk membuat & mengubah website** | top-up akun                                 | top-up akun                  |

Pemakaian di atas batas wajar: pelanggan diberi tahu di dashboard pada 80% dan 100%; kelebihannya ditagih
sesuai biaya vendor + 20% atau pindah ke paket di atasnya. Situs **tidak** dimatikan otomatis karena batas
wajar.

| Segmen               | Harga / website / tahun | Tambahan layanan                                                     |
| -------------------- | ----------------------- | -------------------------------------------------------------------- |
| **Umum / UMKM**      | **Rp 3.000.000**        | Dukungan jam kerja                                                   |
| **Instansi / Pemda** | **Rp 12.000.000**       | Dokumen pengadaan & faktur, pelatihan admin, prioritas respons (SLA) |

Harga belum termasuk PPN. Belanja pemerintah memotong PPh 23 dan memungut PPN — ditangani saat penagihan.

**Siklus langganan:**

```
AKTIF ──(H-30, H-7: email & notifikasi)──> berakhir ──> MASA TENGGANG 30 hari
  ^                                                         │ (situs tetap tayang,
  └──────────── perpanjang kapan saja ──────────────────────┤  banner di dashboard)
                                                            v
                                               KEDALUWARSA: situs diturunkan
                                               (data & versi tetap tersimpan 90 hari,
                                                bisa diterbitkan ulang setelah perpanjang)
```

Project **tanpa** langganan tetap bisa dibuat dan dibangun di Builder (memakai kredit), tetapi **tidak bisa
diterbitkan**. Batas draf tanpa langganan: 10 project per akun (mencegah penyalahgunaan).

### 2. Dompet Kredit AI — per akun, top-up

- Satu **dompet kredit** per **akun**, dipakai untuk **semua project** milik akun itu — tidak dibagi per project.
- Kredit tidak hilang saat Paket Project berakhir atau project dihapus.
- **Tidak ada reset bulanan.** Kredit hasil pembelian **kedaluwarsa 12 bulan** setelah dibeli (selaras
  dengan kredit v0 yang juga kedaluwarsa satu tahun). Pemakaian mengambil kredit yang paling dulu
  kedaluwarsa (FIFO).
- **1 kredit = 1 generate atau edit.** Pola reservasi → commit / refund ([11 §11.4](../11-QUOTA-DAN-BILLING.md))
  tetap berlaku, sekarang terhadap saldo dompet.
- **Kredit sambutan:** akun baru mendapat **5 kredit sekali** (bukan bulanan) untuk mencoba Builder.

| Paket top-up | Harga        | Per kredit | Margin terhadap biaya rata-rata (Rp 6.900) |
| ------------ | ------------ | ---------- | ------------------------------------------ |
| 10 kredit    | Rp 150.000   | Rp 15.000  | 54%                                        |
| 50 kredit    | Rp 650.000   | Rp 13.000  | 47%                                        |
| 100 kredit   | Rp 1.250.000 | Rp 12.500  | 45%                                        |

Pengaman biaya yang sudah ada tetap aktif: ambang biaya harian + kill switch otomatis, dan pemantauan
biaya rata-rata per generate di `/admin`.

### 3. Pembayaran

Sampai Midtrans dibangun ([ADR-010](./ADR-010-pembayaran-midtrans.md), v1.1): **manual** — pelanggan
membayar lewat transfer, lalu Super Admin mengaktifkan langganan / menambah kredit dari `/admin`
(tercatat di audit). Kanal kontak sudah tersedia di halaman Paket.

## Perhitungan Biaya per Project per Tahun

Harga vendor sesuai halaman harga resmi yang terakhir diketahui (kurs Rp 17.700/USD). **Wajib dicek ulang
sebelum harga dijual** — vendor mengubah harga beberapa kali setahun.

| Layanan          | Harga vendor (paket Pro/Launch)                                           |
| ---------------- | ------------------------------------------------------------------------- |
| Vercel transfer  | Termasuk 1 TB per tim, lalu $0,15/GB                                      |
| Vercel Functions | Termasuk kuota tim; lalu ± $0,60/1 jt pemanggilan, ± $0,128/jam CPU aktif |
| Neon Postgres    | Compute ± $0,14/CU-jam (scale-to-zero), storage ± $0,35/GB-bulan          |
| Vercel Blob      | Storage ± $0,023/GB-bulan, transfer ± $0,05/GB, operasi per juta          |

Asumsi pemakaian rata-rata: UMKM = situs profil/katalog ± 3.000 kunjungan/bulan; Pemda = portal
informasi ± 30.000 kunjungan/bulan dengan dokumen unduhan.

| Komponen per project                              | UMKM / bulan          | Pemda / bulan           |
| ------------------------------------------------- | --------------------- | ----------------------- |
| Hosting & transfer                                | $0,50                 | $3,00                   |
| Function                                          | $0,50                 | $3,00                   |
| Neon — compute (UMKM 20 CU-jam, Pemda 120 CU-jam) | $2,80                 | $16,80                  |
| Neon — storage (0,5 GB / 5 GB)                    | $0,18                 | $1,75                   |
| Blob — storage + transfer (2+10 GB / 20+100 GB)   | $0,55                 | $5,50                   |
| Pemantauan, log, cadangan (bagian)                | $0,50                 | $2,00                   |
| **Infrastruktur / bulan**                         | **$5,03 ≈ Rp 89.000** | **$32,05 ≈ Rp 567.000** |

| Per project per tahun                 | UMKM                   | Pemda                  |
| ------------------------------------- | ---------------------- | ---------------------- |
| Infrastruktur (12 bulan)              | Rp 1.070.000           | Rp 6.810.000           |
| Domain (.com/.id; .go.id tanpa biaya) | Rp 200.000             | Rp 0                   |
| Dukungan, onboarding, pelatihan       | Rp 100.000             | Rp 1.500.000           |
| Biaya pembayaran                      | Rp 30.000              | Rp 0                   |
| **Biaya langsung**                    | **Rp 1.400.000**       | **Rp 8.310.000**       |
| **Harga Paket Project**               | **Rp 3.000.000**       | **Rp 12.000.000**      |
| **Kontribusi**                        | **Rp 1.600.000 (53%)** | **Rp 3.690.000 (31%)** |

Biaya tetap platform (seat Vercel Pro, database & Redis platform, Resend, Sentry, operasional) Rp 15–27
juta/tahun tertutup oleh sekitar **10–17 project UMKM** atau **4–7 project Pemda**.

**Catatan penting:**

- Margin ini **lebih rendah** dari perhitungan awal (UMKM 92%, Pemda 86%) karena sekarang setiap project
  memiliki database, storage, dan function sendiri — sebelumnya hanya hosting yang dihitung.
- Pengendali biaya terbesar adalah **compute Neon**. Wajib: scale-to-zero aktif, batas autoscaling
  0,25–1 CU untuk UMKM dan 0,25–2 CU untuk Pemda. Situs statis tanpa kebutuhan data tidak dibuatkan database.
- Paket Pemda bermargin tipis bila portal ramai. Pilihan: naikkan harga ke **Rp 15 juta** (± 45%), atau
  pertahankan Rp 12 juta dengan batas wajar dan tagihan kelebihan.
- Kredit AI tidak mengurangi margin Paket Project karena dibayar terpisah dari dompet akun.

## Perubahan Data & Kode

| Area                        | Perubahan                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Plan`                      | Menjadi **Paket Project** per segmen: `priceYearly`, batas wajar (transfer, function, DB, storage), `maxDeploysPerDay`; kolom kredit dihapus                                     |
| Baru `WebsiteSubscription`  | `projectId`, `planId`, `startsAt`, `endsAt`, `status` (ACTIVE/GRACE/EXPIRED/CANCELLED), `activatedById`, `paymentRef`                                                            |
| Baru `CreditLot`            | Kredit masuk: `userId`, `amount`, `remaining`, `source` (TOPUP/WELCOME/ADMIN), `expiresAt`, `paymentRef`                                                                         |
| Baru `ProjectResource`      | Sumber daya per project: `projectId`, `kind` (NEON_DB/BLOB_STORE), `externalId`, `region`, `status`; kredensial disimpan sebagai env project Vercel, **tidak** di database SaCMS |
| Baru `ProjectUsageSnapshot` | Pemakaian harian per project dari API Vercel & Neon (transfer, function, CU-jam, GB) untuk batas wajar & laporan biaya                                                           |
| `lib/neon` (baru)           | Klien Neon API: buat/hapus database project, set batas autoscaling & scale-to-zero                                                                                               |
| `deploy.service`            | Terbit pertama: siapkan database & Blob store bila situs membutuhkannya, pasang env ke project Vercel; `takeDown` menghapusnya setelah masa simpan                               |
| `UsageEvent`                | Reservasi mengambil dari `CreditLot` FIFO; refund mengembalikan ke lot asal                                                                                                      |
| `User`                      | `planId`, `creditsUsed`, `creditsOverride`, `periodStartedAt` dihapus setelah migrasi                                                                                            |
| `quota.service`             | `assertCanDeploy` & `assertCanAddDomain` memeriksa langganan project; `reserveCreditsInTx` memeriksa saldo dompet                                                                |
| Cron                        | `reset-periods` diganti `subscription-lifecycle`: pengingat H-30/H-7, masa tenggang, penurunan situs; kedaluwarsa lot                                                            |
| UI pengguna                 | Kartu project: status langganan; halaman `Paket & Kredit`: saldo dompet, riwayat, paket top-up, perpanjangan                                                                     |
| UI admin                    | Aktifkan / perpanjang langganan per project, tambah kredit manual, laporan langganan hampir berakhir                                                                             |

Sumber daya per project adalah **kemampuan baru** — saat ini situs hasil v0 hanya di-hosting, belum dibuatkan
database maupun storage. Karena menambah vendor untuk situs pengguna (Neon API), production membutuhkan
secret `NEON_API_KEY`.

Data saat ini masih data uji; migrasi cukup: kredit sisa paket lama dikonversi menjadi `CreditLot`, dan project
yang sedang tayang mendapat langganan uji 30 hari.

## Tahap Pengerjaan (setelah disetujui)

| Tahap | Isi                                                                                   | Perkiraan      |
| ----- | ------------------------------------------------------------------------------------- | -------------- |
| 1     | Skema, migrasi, service dompet kredit akun (lot FIFO, reservasi, refund, kedaluwarsa) | 1,5 hari       |
| 2     | Paket Project: langganan per project; terbit & domain butuh paket aktif; uji service  | 1 hari         |
| 3     | Sumber daya per project: `lib/neon`, Blob store, env ke Vercel, hapus saat diturunkan | 2 hari         |
| 4     | Pemakaian per project: snapshot harian, peringatan 80%/100% batas wajar               | 1 hari         |
| 5     | UI pengguna & admin (aktivasi manual, top-up manual, status paket & pemakaian)        | 1,5 hari       |
| 6     | Cron siklus paket, email pengingat, penurunan situs setelah tenggang                  | 0,5 hari       |
| 7     | Revisi docs 02/11/14, E2E beli–bangun–terbit–kedaluwarsa, halaman harga               | 1 hari         |
|       | **Total**                                                                             | **± 8,5 hari** |

## Alternatif yang Dipertimbangkan

| Alternatif                      | Kelebihan                      | Kekurangan                                      | Alasan ditolak                  |
| ------------------------------- | ------------------------------ | ----------------------------------------------- | ------------------------------- |
| Paket per akun (model sekarang) | Sudah dibangun                 | Sulit dijual per website; kredit bulanan hangus | Tidak sesuai model penjualan    |
| Langganan website bulanan       | Pembayaran awal kecil          | Penagihan 12× setahun; Pemda membeli tahunan    | Pemda & UMKM terbiasa tahunan   |
| AI termasuk dalam paket         | Satu harga saja                | Biaya AI tidak terduga menggerus margin         | Pemilik memilih top-up terpisah |
| Kredit berbobot biaya nyata v0  | Tidak pernah rugi per generate | Sulit dijelaskan ke pengguna awam               | Ditunda; ditinjau bila perlu    |

## Konsekuensi

**Positif:** harga mudah dijelaskan ("Rp 3 juta per project per tahun"); biaya infrastruktur terukur per project; pendapatan paket terprediksi;
biaya AI dibayar pemakainya.

**Negatif:** pelanggan harus membeli kredit sebelum website pertama selesai (dibantu kredit sambutan);
perubahan besar pada `quota.service`, UI paket, dan uji yang sudah ada; vendor bertambah (Neon API untuk
situs pengguna) dan margin Pemda tipis bila portal ramai.

**Yang menjadi lebih sulit:** paket gratis tanpa batas waktu tidak lagi ada — hanya kredit sambutan dan draf.

## Keputusan yang Dibutuhkan dari Pemilik

1. Setuju model: **Paket Project** tahunan (database, storage, function per project) + **kredit AI per akun**?
2. Harga Paket Project: UMKM Rp 3 juta (margin ± 53%); Pemda Rp 12 juta (± 31%) atau naik ke Rp 15 juta (± 45%)?
3. Batas wajar per project (tabel §1) dan cara menangani kelebihan: tagih biaya + 20% atau pindah paket.
4. Harga top-up (Rp 15.000 / 13.000 / 12.500 per kredit) dan kredit sambutan 5 kredit.
5. Masa tenggang 30 hari lalu situs diturunkan — atau lebih lama untuk Pemda?
6. Pembayaran tetap manual dulu, atau Midtrans dimajukan sebelum go-live?

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Biaya rata-rata v0 per generate melebihi Rp 10.000 selama dua minggu berturut-turut.
- Biaya infrastruktur rata-rata satu project melebihi 50% harga paketnya.
- Lebih dari 30% pelanggan tidak memperpanjang setelah tahun pertama.
- Midtrans dibangun — harga top-up dan perpanjangan otomatis ditinjau bersama.
