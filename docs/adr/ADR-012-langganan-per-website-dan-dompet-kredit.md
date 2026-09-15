# ADR-012 — Langganan per Website & Dompet Kredit AI

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

### 1. Langganan Website — per project, tahunan

Setiap website (project) yang **diterbitkan** membutuhkan satu langganan aktif. Isi layanannya **sama
untuk semua segmen** — yang berbeda hanya harga dan layanan pendampingan.

| Termasuk dalam setiap langganan                                         |
| ----------------------------------------------------------------------- |
| Hosting production di Vercel + HTTPS otomatis                           |
| 1 custom domain (+ varian `www`) dan alamat bawaan                      |
| Terbitkan ulang tanpa batas wajar (batas teknis 30/hari per website)    |
| Riwayat versi & rollback, runbook insiden                               |
| Pemantauan ketersediaan & pencadangan database platform                 |
| Dukungan lewat kanal resmi (email/WhatsApp)                             |
| **Tidak termasuk:** kredit AI untuk membuat & mengubah website (top-up) |

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

- Satu **dompet kredit** per akun, dipakai untuk website mana pun milik akun itu.
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

## Perhitungan per website per tahun

| Komponen                        | Umum / UMKM      | Instansi / Pemda  |
| ------------------------------- | ---------------- | ----------------- |
| Hosting Vercel (cadangan)       | Rp 120.000       | Rp 120.000        |
| Dukungan, onboarding, pelatihan | Rp 100.000       | Rp 1.500.000      |
| Biaya pembayaran                | Rp 30.000        | Rp 0              |
| **Biaya langsung**              | **Rp 250.000**   | **Rp 1.620.000**  |
| **Harga**                       | **Rp 3.000.000** | **Rp 12.000.000** |
| **Kontribusi**                  | **Rp 2.750.000** | **Rp 10.380.000** |

Biaya tetap platform Rp 15–27 juta/tahun tertutup oleh sekitar **10 website UMKM** atau **3 website Pemda**.
Kredit AI tidak mengurangi margin paket karena dibayar terpisah dan dijual di atas biaya.

## Perubahan Data & Kode

| Area                       | Perubahan                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `Plan`                     | Menjadi **paket website** per segmen: `priceYearly`, `maxCustomDomains`, `maxDeploysPerDay`; kolom kredit dihapus     |
| Baru `WebsiteSubscription` | `projectId`, `planId`, `startsAt`, `endsAt`, `status` (ACTIVE/GRACE/EXPIRED/CANCELLED), `activatedById`, `paymentRef` |
| Baru `CreditLot`           | Kredit masuk: `userId`, `amount`, `remaining`, `source` (TOPUP/WELCOME/ADMIN), `expiresAt`, `paymentRef`              |
| `UsageEvent`               | Reservasi mengambil dari `CreditLot` FIFO; refund mengembalikan ke lot asal                                           |
| `User`                     | `planId`, `creditsUsed`, `creditsOverride`, `periodStartedAt` dihapus setelah migrasi                                 |
| `quota.service`            | `assertCanDeploy` & `assertCanAddDomain` memeriksa langganan project; `reserveCreditsInTx` memeriksa saldo dompet     |
| Cron                       | `reset-periods` diganti `subscription-lifecycle`: pengingat H-30/H-7, masa tenggang, penurunan situs; kedaluwarsa lot |
| UI pengguna                | Kartu project: status langganan; halaman `Paket & Kredit`: saldo dompet, riwayat, paket top-up, perpanjangan          |
| UI admin                   | Aktifkan / perpanjang langganan per project, tambah kredit manual, laporan langganan hampir berakhir                  |

Data saat ini masih data uji; migrasi cukup: kredit sisa paket lama dikonversi menjadi `CreditLot`, dan project
yang sedang tayang mendapat langganan uji 30 hari.

## Tahap Pengerjaan (setelah disetujui)

| Tahap | Isi                                                                           | Perkiraan      |
| ----- | ----------------------------------------------------------------------------- | -------------- |
| 1     | Skema, migrasi, service dompet (lot FIFO, reservasi, refund, kedaluwarsa)     | 1,5 hari       |
| 2     | Penegakan: terbit & domain butuh langganan; generate butuh saldo; uji service | 1 hari         |
| 3     | UI pengguna & admin (aktivasi manual, top-up manual, status langganan)        | 1,5 hari       |
| 4     | Cron siklus langganan, email pengingat, penurunan situs setelah tenggang      | 0,5 hari       |
| 5     | Revisi docs 11, E2E alur beli–bangun–terbit–kedaluwarsa, halaman harga        | 1 hari         |
|       | **Total**                                                                     | **± 5,5 hari** |

## Alternatif yang Dipertimbangkan

| Alternatif                      | Kelebihan                      | Kekurangan                                      | Alasan ditolak                  |
| ------------------------------- | ------------------------------ | ----------------------------------------------- | ------------------------------- |
| Paket per akun (model sekarang) | Sudah dibangun                 | Sulit dijual per website; kredit bulanan hangus | Tidak sesuai model penjualan    |
| Langganan website bulanan       | Pembayaran awal kecil          | Penagihan 12× setahun; Pemda membeli tahunan    | Pemda & UMKM terbiasa tahunan   |
| AI termasuk dalam paket         | Satu harga saja                | Biaya AI tidak terduga menggerus margin         | Pemilik memilih top-up terpisah |
| Kredit berbobot biaya nyata v0  | Tidak pernah rugi per generate | Sulit dijelaskan ke pengguna awam               | Ditunda; ditinjau bila perlu    |

## Konsekuensi

**Positif:** harga mudah dijelaskan ("Rp 3 juta per website per tahun"); pendapatan paket terprediksi;
biaya AI dibayar pemakainya.

**Negatif:** pelanggan harus membeli kredit sebelum website pertama selesai (dibantu kredit sambutan);
perubahan besar pada `quota.service`, UI paket, dan uji yang sudah ada.

**Yang menjadi lebih sulit:** paket gratis tanpa batas waktu tidak lagi ada — hanya kredit sambutan dan draf.

## Keputusan yang Dibutuhkan dari Pemilik

1. Setuju model: langganan per website tahunan + dompet kredit AI? Harga Rp 3 juta / Rp 12 juta per website?
2. Harga paket top-up (Rp 15.000 / 13.000 / 12.500 per kredit) dan kredit sambutan 5 kredit.
3. Masa tenggang 30 hari lalu situs diturunkan — atau lebih lama untuk Pemda?
4. Pembayaran tetap manual dulu, atau Midtrans dimajukan sebelum go-live?

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Biaya rata-rata v0 per generate melebihi Rp 10.000 selama dua minggu berturut-turut.
- Lebih dari 30% pelanggan tidak memperpanjang setelah tahun pertama.
- Midtrans dibangun — harga top-up dan perpanjangan otomatis ditinjau bersama.
